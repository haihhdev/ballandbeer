import pandas as pd
import requests

# Đường dẫn file Excel
excel_path = r'D:\D Download\ballandbeer_productslist\BallAndBeerProducts.xlsx'

# Đọc file Excel
df = pd.read_excel(excel_path)

for idx, row in df.iterrows():
    name = row['Tên sản phẩm']
    price = int(row['Giá'])
    quantity = int(row['Số lượng'])
    category = row['Danh mục']
    desc = ""  # Nếu có cột mô tả thì lấy, không thì để rỗng
    image = row['Ảnh sản phẩm']  # Giả sử cột này chứa ID của ảnh

    # Tạo dữ liệu gửi lên API
    product_data = {
        "name": name,
        "price": price,
        "quantity": quantity,
        "category": category,
        "desc": desc,
        "image": image  # Sử dụng ID trực tiếp
    }

    # Gửi POST request
    response = requests.post(
        "http://localhost:4003/api/products",
        json=product_data
    )
    print(f"Đã gửi {name}: {response.status_code}")

print("Hoàn thành import!")