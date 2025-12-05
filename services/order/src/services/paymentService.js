const crypto = require("crypto");
const querystring = require("querystring");
// axios will be required dynamically in queryTransactionStatus if needed

// VNPay Sandbox Configuration
// LƯU Ý: Bạn cần đăng ký tài khoản tại https://sandbox.vnpayment.vn/devreg/
// để lấy TMN Code và Secret Key chính xác
const VNPAY_CONFIG = {
  tmnCode: process.env.VNPAY_TMN_CODE, // Sandbox TMN Code - CẦN ĐĂNG KÝ ĐỂ LẤY
  secretKey: process.env.VNPAY_SECRET_KEY, // Sandbox Secret Key - CẦN ĐĂNG KÝ ĐỂ LẤY
  url: process.env.VNPAY_URL,
  returnUrl: process.env.VNPAY_RETURN_URL,
  apiUrl: process.env.VNPAY_API_URL,
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
  // Đảm bảo amount là số và > 0
  if (!amount || amount <= 0) {
    throw new Error("Invalid amount: amount must be greater than 0");
  }
  const amountStr = Math.round(amount * 100).toString();

  // OrderInfo: VNPay hỗ trợ UTF-8, nhưng khi tạo signature thì dùng raw string
  // Tối đa 255 ký tự
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
  // Lưu ý: bankCode phải là string hợp lệ, không null/undefined
  if (bankCode && bankCode.trim() !== "") {
    vnpParams["vnp_BankCode"] = bankCode.trim();
  }

  // Loại bỏ các giá trị null/undefined/empty
  Object.keys(vnpParams).forEach((key) => {
    if (
      vnpParams[key] === null ||
      vnpParams[key] === undefined ||
      vnpParams[key] === ""
    ) {
      delete vnpParams[key];
    }
  });

  // Sắp xếp params theo thứ tự alphabet
  const sortedParams = Object.keys(vnpParams)
    .sort()
    .reduce((acc, key) => {
      acc[key] = vnpParams[key];
      return acc;
    }, {});

  // Tạo query string để ký (không bao gồm SecureHash)
  // VNPay yêu cầu format: key1=value1&key2=value2
  const signData = querystring.stringify(sortedParams);

  // Debug log - CHI TIẾT ĐẦY ĐỦ
  console.log(
    "\n╔════════════════════════════════════════════════════════════════╗"
  );
  console.log(
    "║           VNPay Payment Debug - FULL DETAILS                  ║"
  );
  console.log(
    "╚════════════════════════════════════════════════════════════════╝"
  );
  console.log("\n[CONFIG]");
  console.log("  TMN Code        :", VNPAY_CONFIG.tmnCode);
  console.log("  Secret Key      :", VNPAY_CONFIG.secretKey);
  console.log("  Secret Key Len  :", VNPAY_CONFIG.secretKey.length);
  console.log("  VNPay URL       :", VNPAY_CONFIG.url);
  console.log("  Return URL      :", VNPAY_CONFIG.returnUrl);

  console.log("\n[ORDER INFO]");
  console.log("  Order ID (raw)  :", orderId);
  console.log("  Order ID (clean):", orderIdStr);
  console.log("  Amount (VND)    :", amount);
  console.log("  Amount (VNPay)  :", amountStr);
  console.log("  Bank Code       :", bankCode || "(none)");
  console.log("  IP Address      :", ipAddr);

  console.log("\n[SORTED PARAMS]");
  Object.keys(sortedParams).forEach((key) => {
    console.log(`  ${key}: ${sortedParams[key]}`);
  });

  console.log("\n[SIGN DATA - RAW]");
  console.log(signData);

  console.log("\n[SIGN DATA - INFO]");
  console.log("  Length         :", signData.length);
  console.log("  First 100 chars:", signData.substring(0, 100));

  // Tạo chữ ký HMAC SHA512
  const hmac = crypto.createHmac("sha512", VNPAY_CONFIG.secretKey);
  const signed = hmac.update(Buffer.from(signData, "utf-8")).digest("hex");
  sortedParams["vnp_SecureHash"] = signed;

  console.log("\n[SIGNATURE]");
  console.log("  SecureHash     :", signed);
  console.log("  Hash Length    :", signed.length, "(should be 128)");

  // Tạo URL thanh toán - querystring.stringify tự động URL encode
  const paymentUrl =
    VNPAY_CONFIG.url + "?" + querystring.stringify(sortedParams);

  console.log("\n[FINAL PAYMENT URL]");
  console.log(paymentUrl);
  console.log("\n  URL Length:", paymentUrl.length);

  console.log(
    "\n╔════════════════════════════════════════════════════════════════╗"
  );
  console.log(
    "║  COPY URL TRÊN ĐỂ TEST TRONG BROWSER                         ║"
  );
  console.log(
    "║  Nếu vẫn lỗi 'Invalid data format':                          ║"
  );
  console.log(
    "║  1. Kiểm tra Secret Key có đúng 32 ký tự                     ║"
  );
  console.log(
    "║  2. Kiểm tra TMN Code = KYM639SZ                             ║"
  );
  console.log(
    "║  3. Copy Secret Key từ VNPay Portal                          ║"
  );
  console.log(
    "╚════════════════════════════════════════════════════════════════╝\n"
  );

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
