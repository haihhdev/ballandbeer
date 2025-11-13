const crypto = require("crypto");
const querystring = require("querystring");
// axios will be required dynamically in queryTransactionStatus if needed

// VNPay Sandbox Configuration
// LƯU Ý: Bạn cần đăng ký tài khoản tại https://sandbox.vnpayment.vn/devreg/
// để lấy TMN Code và Secret Key chính xác
const VNPAY_CONFIG = {
  tmnCode: process.env.VNPAY_TMN_CODE || "KYM639SZ", // Sandbox TMN Code - CẦN ĐĂNG KÝ ĐỂ LẤY
  secretKey: process.env.VNPAY_SECRET_KEY || "EGBL3OLMSIV7AMW5M7T1MA6AOPM11XDQ", // Sandbox Secret Key - CẦN ĐĂNG KÝ ĐỂ LẤY
  url:
    process.env.VNPAY_URL ||
    "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html",
  returnUrl:
    process.env.VNPAY_RETURN_URL || "http://localhost:3000/payment/callback",
  apiUrl:
    process.env.VNPAY_API_URL ||
    "https://sandbox.vnpayment.vn/merchant_webapi/api/transaction",
};

/**
 * Tạo URL thanh toán VNPay
 */
exports.createPaymentUrl = (
  orderId,
  amount,
  bankCode = null,
  orderInfo = null,
  ipAddr = "127.0.0.1"
) => {
  const date = new Date();
  const createDate =
    date.toISOString().replace(/[-:]/g, "").split(".")[0] + "00";
  const expireDate =
    new Date(date.getTime() + 15 * 60 * 1000) // 15 phút
      .toISOString()
      .replace(/[-:]/g, "")
      .split(".")[0] + "00";

  // VNPay yêu cầu TxnRef tối đa 100 ký tự, không có ký tự đặc biệt
  const orderIdStr = orderId
    .toString()
    .replace(/[^a-zA-Z0-9]/g, "")
    .substring(0, 100);
  // VNPay yêu cầu số tiền phải nhân 100 (ví dụ: 790000 VND -> 79000000)
  const amountStr = Math.round(amount * 100).toString();
  // OrderInfo cần encode và tối đa 255 ký tự
  const orderInfoStr = (
    orderInfo || `Thanh toan don hang ${orderIdStr}`
  ).substring(0, 255);
  const locale = "vn";
  const currCode = "VND";
  const vnpVersion = "2.1.0";
  const vnpCommand = "pay";
  const vnpOrderType = "other";

  let vnpParams = {};
  vnpParams["vnp_Version"] = vnpVersion;
  vnpParams["vnp_Command"] = vnpCommand;
  vnpParams["vnp_TmnCode"] = VNPAY_CONFIG.tmnCode;
  vnpParams["vnp_Locale"] = locale;
  vnpParams["vnp_CurrCode"] = currCode;
  vnpParams["vnp_TxnRef"] = orderIdStr;
  vnpParams["vnp_OrderInfo"] = orderInfoStr;
  vnpParams["vnp_OrderType"] = vnpOrderType;
  vnpParams["vnp_Amount"] = amountStr;
  vnpParams["vnp_ReturnUrl"] = VNPAY_CONFIG.returnUrl;
  vnpParams["vnp_IpAddr"] = ipAddr;
  vnpParams["vnp_CreateDate"] = createDate;
  vnpParams["vnp_ExpireDate"] = expireDate;

  // Nếu có bankCode, thêm vào params
  // VNPay bank codes: VNBANK (Vietcombank), BIDV (BIDV), etc.
  if (bankCode) {
    vnpParams["vnp_BankCode"] = bankCode;
  }

  // Sắp xếp params theo thứ tự alphabet
  const sortedParams = Object.keys(vnpParams)
    .sort()
    .reduce((acc, key) => {
      acc[key] = vnpParams[key];
      return acc;
    }, {});

  // Tạo query string để ký (không bao gồm SecureHash)
  const signData = querystring.stringify(sortedParams, { encode: false });

  // Debug log (chỉ trong development)
  if (process.env.NODE_ENV === "development") {
    console.log("VNPay Sign Data:", signData);
    console.log("VNPay Secret Key length:", VNPAY_CONFIG.secretKey.length);
  }

  // Tạo chữ ký HMAC SHA512
  const hmac = crypto.createHmac("sha512", VNPAY_CONFIG.secretKey);
  const signed = hmac.update(Buffer.from(signData, "utf-8")).digest("hex");
  sortedParams["vnp_SecureHash"] = signed;

  // Tạo URL thanh toán - cần URL encode các giá trị
  const paymentUrl =
    VNPAY_CONFIG.url +
    "?" +
    querystring.stringify(sortedParams, { encode: true });

  // Debug log
  if (process.env.NODE_ENV === "development") {
    console.log("VNPay Payment URL:", paymentUrl.substring(0, 200) + "...");
  }

  return paymentUrl;
};

/**
 * Xác thực callback từ VNPay
 */
exports.verifyPaymentCallback = (vnpParams) => {
  const secureHash = vnpParams["vnp_SecureHash"];
  delete vnpParams["vnp_SecureHash"];
  delete vnpParams["vnp_SecureHashType"];

  // Sắp xếp params
  const sortedParams = Object.keys(vnpParams)
    .sort()
    .reduce((acc, key) => {
      acc[key] = vnpParams[key];
      return acc;
    }, {});

  // Tạo query string
  const signData = querystring.stringify(sortedParams, { encode: false });
  const hmac = crypto.createHmac("sha512", VNPAY_CONFIG.secretKey);
  const signed = hmac.update(Buffer.from(signData, "utf-8")).digest("hex");

  // So sánh chữ ký
  if (secureHash === signed) {
    const responseCode = vnpParams["vnp_ResponseCode"];
    return {
      isValid: true,
      isSuccess: responseCode === "00",
      orderId: vnpParams["vnp_TxnRef"],
      amount: parseInt(vnpParams["vnp_Amount"]) / 100, // VNPay trả về số tiền nhân 100
      transactionId: vnpParams["vnp_TransactionNo"],
      bankCode: vnpParams["vnp_BankCode"],
      responseCode: responseCode,
      message: vnpParams["vnp_TransactionStatus"],
    };
  }

  return {
    isValid: false,
    isSuccess: false,
  };
};

/**
 * Kiểm tra trạng thái giao dịch từ VNPay
 */
exports.queryTransactionStatus = async (orderId) => {
  const date = new Date();
  const createDate =
    date.toISOString().replace(/[-:]/g, "").split(".")[0] + "00";

  let vnpParams = {};
  vnpParams["vnp_Version"] = "2.1.0";
  vnpParams["vnp_Command"] = "querydr";
  vnpParams["vnp_TmnCode"] = VNPAY_CONFIG.tmnCode;
  vnpParams["vnp_TxnRef"] = orderId.toString();
  vnpParams["vnp_OrderInfo"] = `Kiem tra trang thai don hang ${orderId}`;
  vnpParams["vnp_TransactionDate"] = createDate;
  vnpParams["vnp_CreateDate"] = createDate;
  vnpParams["vnp_IpAddr"] = "127.0.0.1";

  // Sắp xếp và ký
  const sortedParams = Object.keys(vnpParams)
    .sort()
    .reduce((acc, key) => {
      acc[key] = vnpParams[key];
      return acc;
    }, {});

  const signData = querystring.stringify(sortedParams, { encode: false });
  const hmac = crypto.createHmac("sha512", VNPAY_CONFIG.secretKey);
  const signed = hmac.update(Buffer.from(signData, "utf-8")).digest("hex");
  sortedParams["vnp_SecureHash"] = signed;

  try {
    // Dynamic require axios to avoid error if not installed
    let axios;
    try {
      axios = require("axios");
    } catch (e) {
      console.warn("axios not installed, skipping transaction query");
      return {
        success: false,
        error: "axios package not installed. Please run: npm install axios",
      };
    }

    const response = await axios.post(
      VNPAY_CONFIG.apiUrl,
      querystring.stringify(sortedParams),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error("Error querying transaction:", error);
    return {
      success: false,
      error: error.message,
    };
  }
};
