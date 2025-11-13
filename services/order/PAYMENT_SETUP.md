# Hướng dẫn cấu hình thanh toán VNPay

## Tổng quan

Hệ thống đã được tích hợp với VNPay Sandbox để hỗ trợ thanh toán test qua Vietcombank (VCB) và BIDV. Đây là môi trường test, không sử dụng tiền thật.

## Cài đặt

1. Cài đặt các package cần thiết:

```bash
cd services/order
npm install
```

## Cấu hình môi trường

Thêm các biến môi trường sau vào file `.env` hoặc Vault:

```env
# VNPay Sandbox Configuration
VNPAY_TMN_CODE=2QXUI4J4
VNPAY_SECRET_KEY=RAOCTEXKRVQHBZELXUNPHNQZQZQZQZQ
VNPAY_URL=https://sandbox.vnpayment.vn/paymentv2/vpcpay.html
VNPAY_RETURN_URL=http://localhost:3000/payment/callback
VNPAY_API_URL=https://sandbox.vnpayment.vn/merchant_webapi/api/transaction
FRONTEND_URL=http://localhost:3000
```

**Lưu ý:**

- Các giá trị trên là mặc định cho VNPay Sandbox
- Để sử dụng production, bạn cần đăng ký tài khoản VNPay và lấy thông tin từ họ
- `VNPAY_RETURN_URL` và `FRONTEND_URL` cần được cập nhật theo domain thực tế khi deploy

## Cách hoạt động

1. **Tạo payment URL**: Khi khách hàng chọn phương thức thanh toán (VCB hoặc BIDV), hệ thống sẽ gọi API `/api/payment/create-url` để tạo URL thanh toán từ VNPay
2. **Redirect đến VNPay**: Khách hàng được chuyển đến trang thanh toán VNPay Sandbox
3. **Thanh toán**: Khách hàng thực hiện thanh toán trên VNPay (môi trường test)
4. **Callback**: VNPay sẽ gọi callback về `/api/payment/callback` để xác nhận kết quả
5. **Cập nhật đơn hàng**: Hệ thống tự động cập nhật trạng thái đơn hàng và lưu thông tin giao dịch

## API Endpoints

### POST `/api/payment/create-url`

Tạo URL thanh toán VNPay

**Request:**

```json
{
  "orderId": "order_id_here",
  "bankCode": "VNBANK" // hoặc "BIDV"
}
```

**Response:**

```json
{
  "success": true,
  "paymentUrl": "https://sandbox.vnpayment.vn/...",
  "orderId": "order_id_here"
}
```

### GET `/api/payment/callback`

Xử lý callback từ VNPay (tự động redirect về frontend)

### GET `/api/payment/status/:orderId`

Kiểm tra trạng thái thanh toán

## Bank Codes

- `VNBANK`: Vietcombank (VCB)
- `BIDV`: BIDV

## Testing

1. Tạo đơn hàng trong hệ thống
2. Chọn phương thức thanh toán VCB hoặc BIDV
3. Click "Thanh toán qua VNPay"
4. Trên trang VNPay Sandbox, bạn có thể test với các tài khoản test
5. Sau khi thanh toán thành công, bạn sẽ được redirect về trang callback

## Lưu ý

- Đây là môi trường Sandbox, không sử dụng tiền thật
- Cần có logo BIDV tại `/public/images/bidv.png` (hoặc cập nhật đường dẫn trong `paymentprod.jsx`)
- Đảm bảo `VNPAY_RETURN_URL` khớp với URL callback trong cấu hình VNPay
