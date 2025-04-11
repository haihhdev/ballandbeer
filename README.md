# 🏟️ Ball & Beer - Microservices Web App

Dự án web app cho phép người dùng **đặt sân bóng** và **mua hàng**, được xây dựng theo kiến trúc **microservices** với frontend Next.js và backend triển khai trên AWS.

---

## 🧱 Kiến trúc dự án

/frontend ← Giao diện người dùng (Next.js) /services ← Các microservices backend /auth ← Xác thực và phân quyền /user ← Quản lý thông tin người dùng /booking ← Đặt sân bóng /product ← Quản lý sản phẩm /order ← Đơn hàng /payment ← Thanh toán /k8s ← Kubernetes manifest /infra/terraform ← Mã hạ tầng Terraform (AWS, EKS, MongoDB) /docker-compose.yml ← Dev environment local

## 🚀 Công nghệ sử dụng

| Thành phần | Công nghệ |
|------------|-----------|
| Frontend   | [Next.js](https://nextjs.org/), TailwindCSS |
| Backend    | Node.js, ExpressJS / NestJS, MongoDB |
| CI/CD      | Jenkins, GitHub Actions |
| Hạ tầng    | AWS (EKS, S3, ECR, RDS...), Terraform |
| ML Pipeline| Kubeflow trên EKS |
| Container  | Docker, Kubernetes |

---

## 🛠️ Các service

| Service   | Mô tả |
|-----------|------|
| `auth`    | Đăng ký, đăng nhập, refresh token |
| `user`    | Hồ sơ người dùng |
| `booking` | Đặt lịch sân bóng |
| `product` | Danh mục và thông tin sản phẩm |
| `order`   | Xử lý đơn hàng |
| `payment` | Kết nối thanh toán (VNPay, Momo...) |

---

## 🧪 Dev local

Chạy toàn bộ bằng Docker Compose:

```bash
docker-compose up --build

---

## Tích hợp ML (Kubeflow)

Kubeflow sẽ được cài trên cụm EKS để hỗ trợ:

Huấn luyện mô hình (gợi ý sân, dự đoán nhu cầu)

Quản lý pipeline ML

Tích hợp prediction endpoint cho các service