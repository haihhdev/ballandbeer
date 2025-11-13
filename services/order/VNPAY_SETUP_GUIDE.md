# Hướng dẫn đăng ký và cấu hình VNPay Sandbox

## Vấn đề: Lỗi "Invalid data format" (Code 03)

Lỗi này thường xảy ra khi:

1. **TMN Code hoặc Secret Key không đúng** - Đây là nguyên nhân phổ biến nhất
2. Format dữ liệu không đúng (đã được sửa trong code)
3. Signature không đúng

## Giải pháp: Đăng ký tài khoản VNPay Sandbox

### Bước 1: Truy cập trang đăng ký

1. Truy cập: **https://sandbox.vnpayment.vn/devreg/**
2. Bạn sẽ thấy form đăng ký "ĐĂNG KÝ MERCHANT MÔI TRƯỜNG TEST"

### Bước 2: Điền thông tin đăng ký

Điền đầy đủ các trường sau:

1. **Tên website** (Website Name):

   - Ví dụ: `Ball and Beer` hoặc `BallandBeer`
   - Tên website/dự án của bạn

2. **Địa chỉ URL** (URL Address):

   - Ví dụ: `http://localhost:3000` hoặc domain thực tế của bạn
   - URL của website bạn đang phát triển
   - **Lưu ý**: Có thể dùng `http://localhost:3000` cho môi trường test local

3. **Email đăng ký** (Registration Email):

   - Email của bạn (sẽ nhận thông tin TMN Code và Secret Key qua email này)
   - Ví dụ: `your-email@gmail.com`
   - **Quan trọng**: Sử dụng email thật, bạn sẽ nhận thông tin quan trọng qua email này

4. **Mật khẩu** (Password):

   - Tạo mật khẩu mạnh (ít nhất 8 ký tự, có chữ hoa, chữ thường, số)
   - Ví dụ: `MySecurePass123!`
   - **Lưu ý**: Lưu lại mật khẩu để đăng nhập sau này

5. **Nhập lại mật khẩu** (Re-enter Password):

   - Nhập lại mật khẩu vừa tạo
   - Phải khớp với mật khẩu ở trên

6. **Mã xác nhận** (Captcha):
   - Nhập mã xác nhận hiển thị trong hình (ví dụ: `8T6SJF`)
   - **Lưu ý**: Phân biệt chữ hoa/thường
   - Nếu không rõ, click vào icon refresh (↻) để làm mới mã

### Bước 3: Xác nhận đăng ký

1. Kiểm tra lại tất cả thông tin đã điền
2. Click nút **"Đăng ký"** (Register) màu xanh ở cuối form
3. Nếu thành công, bạn sẽ thấy thông báo xác nhận
4. **Kiểm tra email** để xác nhận tài khoản (nếu có)

### Bước 4: Đăng nhập và lấy thông tin

1. Sau khi đăng ký thành công, đăng nhập vào: **https://sandbox.vnpayment.vn/**
2. Sử dụng email và mật khẩu vừa tạo
3. Sau khi đăng nhập, bạn sẽ thấy hoặc nhận được qua email:

   - **TMN Code** (Terminal Code): Mã định danh merchant của bạn

     - Ví dụ: `2QXUI4J4` hoặc mã khác
     - Thường có 8-10 ký tự
     - Tìm trong phần "Thông tin merchant" hoặc "Cấu hình"

   - **Secret Key** (Hash Secret): Khóa bí mật để tạo chữ ký
     - Ví dụ: `RAOCTEXKRVQHBZELXUNPHNQZQZQZQZQ` hoặc chuỗi khác
     - Thường có 32-64 ký tự
     - Tìm trong phần "Thông tin merchant" hoặc "Cấu hình"

### Bước 5: Cấu hình vào hệ thống

Thêm vào file `.env` hoặc Vault:

```env
VNPAY_TMN_CODE=YOUR_TMN_CODE_HERE
VNPAY_SECRET_KEY=YOUR_SECRET_KEY_HERE
VNPAY_RETURN_URL=http://localhost:3000/payment/callback
FRONTEND_URL=http://localhost:3000
```

**Ví dụ:**

```env
VNPAY_TMN_CODE=2QXUI4J4
VNPAY_SECRET_KEY=RAOCTEXKRVQHBZELXUNPHNQZQZQZQZQ
VNPAY_RETURN_URL=http://localhost:3000/payment/callback
FRONTEND_URL=http://localhost:3000
```

**Lưu ý quan trọng:**

- Copy chính xác TMN Code và Secret Key (không có khoảng trắng thừa)
- Secret Key phải được bảo mật, không commit lên Git
- Nếu dùng Vault, thêm vào secret store

### Bước 6: Restart service

```bash
cd services/order
npm start
```

## Kiểm tra sau khi cấu hình

Sau khi cấu hình, kiểm tra logs để xem:

- Sign Data được tạo đúng chưa
- Secret Key có độ dài đúng không (thường là 32 hoặc 64 ký tự)
- Payment URL được tạo đúng chưa

Nếu vẫn gặp lỗi, kiểm tra:

- TMN Code và Secret Key đã copy đúng chưa (không có khoảng trắng thừa)
- Đã restart service chưa
- Logs có hiển thị lỗi gì không

## Lưu ý quan trọng

- **KHÔNG** sử dụng TMN Code và Secret Key mặc định trong code
- Mỗi tài khoản VNPay Sandbox có TMN Code và Secret Key riêng
- Secret Key phải được bảo mật, không commit lên Git
- Môi trường Sandbox chỉ dùng để test, không sử dụng tiền thật

## Tài liệu tham khảo

- Trang đăng ký: https://sandbox.vnpayment.vn/devreg/
- Tài liệu API: https://sandbox.vnpayment.vn/apis/docs/thanh-toan-pay/pay.html
- Bảng mã lỗi: https://sandbox.vnpayment.vn/apis/docs/bang-ma-loi/

## Troubleshooting

### Lỗi khi đăng ký:

- Kiểm tra email đã tồn tại chưa (nếu có, thử email khác)
- Kiểm tra mật khẩu đủ mạnh chưa
- Kiểm tra mã captcha đã nhập đúng chưa

### Không nhận được email:

- Kiểm tra thư mục Spam/Junk
- Đợi vài phút
- Thử đăng nhập trực tiếp với email và mật khẩu đã tạo

### Không tìm thấy TMN Code/Secret Key:

- Đăng nhập vào dashboard VNPay Sandbox
- Tìm trong phần "Thông tin merchant" hoặc "Cấu hình"
- Liên hệ support nếu vẫn không thấy
