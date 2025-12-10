const crypto = require("crypto");
const querystring = require("qs");

// ───────────────────────────────────────────
// VNPay CONFIG - Lazy loading để đảm bảo Vault secrets đã được load
// ───────────────────────────────────────────
const getVNPayConfig = () => ({
  tmnCode: process.env.VNPAY_TMN_CODE,
  secretKey: process.env.VNPAY_SECRET_KEY,
  url:
    process.env.VNPAY_URL ||
    "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html",
  returnUrl: process.env.VNPAY_RETURN_URL,
  apiUrl:
    process.env.VNPAY_API_URL ||
    "https://sandbox.vnpayment.vn/merchant_webapi/api/transaction",
});

// Log config khi được gọi lần đầu
let configLogged = false;
const logConfig = () => {
  if (!configLogged) {
    const config = getVNPayConfig();
    console.log("\n>>> VNPay Config (from Vault/Env) <<<");
    console.log("TMN Code:", config.tmnCode);
    console.log(
      "Secret Key:",
      config.secretKey ? `${config.secretKey.substring(0, 10)}...` : "UNDEFINED"
    );
    console.log("URL:", config.url);
    console.log("Return URL:", config.returnUrl);
    configLogged = true;
  }
};

// ───────────────────────────────────────────
// Hàm sort object (COPY CHÍNH XÁC TỪ CODE DEMO VNPAY)
// ───────────────────────────────────────────
function sortObject(obj) {
  let sorted = {};
  let str = [];
  let key;
  for (key in obj) {
    // Sử dụng Object.prototype.hasOwnProperty.call thay vì obj.hasOwnProperty
    // vì req.query có thể là object không có prototype
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      str.push(encodeURIComponent(key));
    }
  }
  str.sort();
  for (key = 0; key < str.length; key++) {
    sorted[str[key]] = encodeURIComponent(obj[str[key]]).replace(/%20/g, "+");
  }
  return sorted;
}

// ───────────────────────────────────────────
// Tạo URL thanh toán VNPay (theo code demo chính thức)
// ───────────────────────────────────────────
exports.createPaymentUrl = (
  orderId,
  amount,
  bankCode = null,
  orderInfo = null,
  ipAddr = "127.0.0.1"
) => {
  // Lấy config từ Vault/Env (đảm bảo đã được load)
  const VNPAY_CONFIG = getVNPayConfig();
  logConfig();

  const date = new Date();
  const createDate =
    date.getFullYear().toString() +
    ("0" + (date.getMonth() + 1)).slice(-2) +
    ("0" + date.getDate()).slice(-2) +
    ("0" + date.getHours()).slice(-2) +
    ("0" + date.getMinutes()).slice(-2) +
    ("0" + date.getSeconds()).slice(-2);

  const orderIdStr = orderId.toString().replace(/[^a-zA-Z0-9]/g, "");
  const amountStr = Math.round(amount * 100).toString();
  const orderInfoStr = (
    orderInfo || `Thanh toan don hang ${orderIdStr}`
  ).substring(0, 255);

  // Tạo TxnRef duy nhất: orderId + timestamp để tránh lỗi "giao dịch đã tồn tại"
  const timestamp = Date.now().toString().slice(-8); // Lấy 8 chữ số cuối của timestamp
  const uniqueTxnRef = `${orderIdStr.slice(-16)}${timestamp}`; // Giới hạn độ dài để đảm bảo không quá 100 ký tự

  let vnp_Params = {};
  vnp_Params["vnp_Version"] = "2.1.0";
  vnp_Params["vnp_Command"] = "pay";
  vnp_Params["vnp_TmnCode"] = VNPAY_CONFIG.tmnCode;
  vnp_Params["vnp_Locale"] = "vn";
  vnp_Params["vnp_CurrCode"] = "VND";
  vnp_Params["vnp_TxnRef"] = uniqueTxnRef;
  vnp_Params["vnp_OrderInfo"] = orderInfoStr;
  vnp_Params["vnp_OrderType"] = "other";
  vnp_Params["vnp_Amount"] = amountStr;
  vnp_Params["vnp_ReturnUrl"] = VNPAY_CONFIG.returnUrl;
  vnp_Params["vnp_IpAddr"] = ipAddr;
  vnp_Params["vnp_CreateDate"] = createDate;

  if (bankCode) {
    vnp_Params["vnp_BankCode"] = bankCode.trim();
  }

  console.log("\n>>> VNPay DEBUG - BEFORE Sort <<<");
  console.log(
    "vnp_Params BEFORE sortObject:",
    JSON.stringify(vnp_Params, null, 2)
  );

  vnp_Params = sortObject(vnp_Params);

  console.log("\n>>> VNPay DEBUG - AFTER Sort <<<");
  console.log(
    "vnp_Params AFTER sortObject:",
    JSON.stringify(vnp_Params, null, 2)
  );

  // Dùng querystring.stringify với encode: false (CHÍNH XÁC THEO DEMO VNPAY)
  let signData = querystring.stringify(vnp_Params, { encode: false });

  console.log("\n>>> VNPay DEBUG - Sign Data <<<");
  console.log("Sign Data:", signData);
  console.log("Secret Key:", VNPAY_CONFIG.secretKey);
  console.log(
    "Secret Key Length:",
    VNPAY_CONFIG.secretKey ? VNPAY_CONFIG.secretKey.length : "N/A"
  );

  let hmac = crypto.createHmac("sha512", VNPAY_CONFIG.secretKey);
  let signed = hmac.update(Buffer.from(signData, "utf-8")).digest("hex");
  vnp_Params["vnp_SecureHash"] = signed;

  // Tạo URL (CHÍNH XÁC THEO DEMO VNPAY)
  let vnpUrl =
    VNPAY_CONFIG.url +
    "?" +
    querystring.stringify(vnp_Params, { encode: false });

  console.log("\n>>> VNPay Payment URL Generation (OFFICIAL DEMO) <<<");
  console.log("Secure Hash:", signed);
  console.log("Payment URL:", vnpUrl);
  console.log("TxnRef:", uniqueTxnRef);

  return { paymentUrl: vnpUrl, txnRef: uniqueTxnRef };
};

// ───────────────────────────────────────────
// Verify callback từ VNPay
// ───────────────────────────────────────────
exports.verifyPaymentCallback = (vnpParams) => {
  // Lấy config từ Vault/Env
  const VNPAY_CONFIG = getVNPayConfig();

  let secureHash = vnpParams["vnp_SecureHash"];

  delete vnpParams["vnp_SecureHash"];
  delete vnpParams["vnp_SecureHashType"];

  vnpParams = sortObject(vnpParams);

  // Dùng querystring.stringify với encode: false (CHÍNH XÁC THEO DEMO VNPAY)
  let signData = querystring.stringify(vnpParams, { encode: false });
  let hmac = crypto.createHmac("sha512", VNPAY_CONFIG.secretKey);
  let signed = hmac.update(Buffer.from(signData, "utf-8")).digest("hex");

  console.log("\n>>> VNPay Callback Verification <<<");
  console.log("Sign Data:", signData);
  console.log("Calculated Hash:", signed);
  console.log("Received Hash:", secureHash);
  console.log("Match:", signed === secureHash);

  if (signed === secureHash) {
    const rspCode = vnpParams["vnp_ResponseCode"];
    return {
      isValid: true,
      isSuccess: rspCode === "00",
      orderId: vnpParams["vnp_TxnRef"],
      amount: parseInt(vnpParams["vnp_Amount"]) / 100,
      transactionId: vnpParams["vnp_TransactionNo"],
      bankCode: vnpParams["vnp_BankCode"],
      responseCode: rspCode,
      message: vnpParams["vnp_TransactionStatus"],
    };
  }

  return { isValid: false, isSuccess: false };
};

// ───────────────────────────────────────────
// Query transaction status
// ───────────────────────────────────────────
exports.queryTransactionStatus = async (orderId) => {
  // Lấy config từ Vault/Env
  const VNPAY_CONFIG = getVNPayConfig();

  const date = new Date();
  const createDate =
    date.getFullYear().toString() +
    ("0" + (date.getMonth() + 1)).slice(-2) +
    ("0" + date.getDate()).slice(-2) +
    ("0" + date.getHours()).slice(-2) +
    ("0" + date.getMinutes()).slice(-2) +
    ("0" + date.getSeconds()).slice(-2);

  let vnp_Params = {};
  vnp_Params["vnp_Version"] = "2.1.0";
  vnp_Params["vnp_Command"] = "querydr";
  vnp_Params["vnp_TmnCode"] = VNPAY_CONFIG.tmnCode;
  vnp_Params["vnp_TxnRef"] = orderId.toString();
  vnp_Params["vnp_OrderInfo"] = `Truy van GD: ${orderId}`;
  vnp_Params["vnp_TransactionDate"] = createDate;
  vnp_Params["vnp_CreateDate"] = createDate;
  vnp_Params["vnp_IpAddr"] = "127.0.0.1";

  vnp_Params = sortObject(vnp_Params);

  // Dùng querystring.stringify với encode: false (CHÍNH XÁC THEO DEMO VNPAY)
  let signData = querystring.stringify(vnp_Params, { encode: false });
  let hmac = crypto.createHmac("sha512", VNPAY_CONFIG.secretKey);
  let signed = hmac.update(Buffer.from(signData, "utf-8")).digest("hex");
  vnp_Params["vnp_SecureHash"] = signed;

  // Build request body (CHÍNH XÁC THEO DEMO VNPAY)
  const requestBody = querystring.stringify(vnp_Params, { encode: false });

  try {
    const axios = require("axios");
    const response = await axios.post(VNPAY_CONFIG.apiUrl, requestBody, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });

    return { success: true, data: response.data };
  } catch (error) {
    return { success: false, error: error.message };
  }
};
