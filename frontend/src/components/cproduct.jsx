"use client"
import React, { useState, useRef } from "react";

export default function CreateProductForm() {
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [quantity, setQuantity] = useState("");
  const [category, setCategory] = useState("");
  const [desc, setDesc] = useState("");
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const fileInputRef = useRef(null);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImage(file);
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      let imageBase64 = null;
      if (image) {
        const reader = new FileReader();
        reader.readAsDataURL(image);
        await new Promise((resolve) => {
          reader.onloadend = () => {
            imageBase64 = reader.result;
            resolve();
          };
        });
      }

      const productData = {
        name,
        price: Number(price),
        quantity: Number(quantity),
        category,
        desc,
        image: imageBase64
      };

      const response = await fetch("/api/products", {
        method: "POST",
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(productData)
      });

      if (response.ok) {
        setMessage("Tạo sản phẩm thành công!");
        setName("");
        setPrice("");
        setQuantity("");
        setCategory("");
        setDesc("");
        setImage(null);
        setImagePreview(null);
      } else {
        const errorData = await response.json();
        setMessage(errorData.message || "Có lỗi xảy ra khi tạo sản phẩm!");
      }
    } catch (err) {
      setMessage("Lỗi kết nối server!");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-md mx-auto bg-white p-6 rounded shadow space-y-4">
      <h2 className="text-xl font-bold mb-2">Tạo sản phẩm mới</h2>
      {message && <div className="text-center text-sm text-green-600">{message}</div>}
      <div>
        <label className="block font-medium mb-1">Tên sản phẩm</label>
        <input type="text" className="w-full border rounded px-3 py-2" value={name} onChange={e => setName(e.target.value)} required />
      </div>
      <div>
        <label className="block font-medium mb-1">Giá</label>
        <input type="number" className="w-full border rounded px-3 py-2" value={price} onChange={e => setPrice(e.target.value)} required min={0} />
      </div>
      <div>
        <label className="block font-medium mb-1">Số lượng</label>
        <input type="number" className="w-full border rounded px-3 py-2" value={quantity} onChange={e => setQuantity(e.target.value)} required min={0} />
      </div>
      <div>
        <label className="block font-medium mb-1">Danh mục</label>
        <input type="text" className="w-full border rounded px-3 py-2" value={category} onChange={e => setCategory(e.target.value)} />
      </div>
      <div>
        <label className="block font-medium mb-1">Mô tả</label>
        <textarea className="w-full border rounded px-3 py-2" value={desc} onChange={e => setDesc(e.target.value)} rows={3} />
      </div>
      <div>
        <label className="block font-medium mb-1">Ảnh sản phẩm</label>
        <input type="file" accept="image/*" ref={fileInputRef} onChange={handleImageChange} />
        {imagePreview && <img src={imagePreview} alt="preview" className="mt-2 h-24 rounded object-cover" />}
      </div>
      <button type="submit" className="w-full bg-yellow-500 hover:bg-yellow-600 text-white font-semibold py-2 rounded" disabled={loading}>
        {loading ? "Đang tạo..." : "Tạo sản phẩm"}
      </button>
    </form>
  );
}
