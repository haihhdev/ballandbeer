"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("products");
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  // Products state
  const [products, setProducts] = useState([]);
  const [showProductForm, setShowProductForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  
  // Users state
  const [users, setUsers] = useState([]);

  // Product form state
  const [productForm, setProductForm] = useState({
    name: "",
    category: "",
    price: "",
    description: "",
    stock: "",
    image: "",
  });

  useEffect(() => {
    // Check if user is admin
    const userData = localStorage.getItem("userData");
    if (userData) {
      const user = JSON.parse(userData);
      if (user.isAdmin) {
        setIsAdmin(true);
        loadProducts();
        loadUsers();
      } else {
        router.push("/");
      }
    } else {
      router.push("/login");
    }
    setLoading(false);
  }, [router]);

  const getAuthHeaders = () => {
    const token = localStorage.getItem("token");
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };
  };

  // Load products
  const loadProducts = async () => {
    try {
      const response = await fetch("http://localhost:5002/api/products");
      const data = await response.json();
      setProducts(data);
    } catch (error) {
      console.error("Error loading products:", error);
      alert("Failed to load products");
    }
  };

  // Load users
  const loadUsers = async () => {
    try {
      const response = await fetch("http://localhost:5001/api/admin/users", {
        headers: getAuthHeaders(),
      });
      const data = await response.json();
      if (data.success) {
        setUsers(data.data);
      }
    } catch (error) {
      console.error("Error loading users:", error);
      alert("Failed to load users");
    }
  };

  // Handle product form change
  const handleProductFormChange = (e) => {
    const { name, value } = e.target;
    setProductForm((prev) => ({ ...prev, [name]: value }));
  };

  // Handle image upload
  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setProductForm((prev) => ({ ...prev, image: reader.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  // Create or update product
  const handleProductSubmit = async (e) => {
    e.preventDefault();
    try {
      const url = editingProduct
        ? `http://localhost:5002/api/products/${editingProduct._id}`
        : "http://localhost:5002/api/products";
      
      const method = editingProduct ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: getAuthHeaders(),
        body: JSON.stringify(productForm),
      });

      if (response.ok) {
        alert(editingProduct ? "Product updated successfully!" : "Product created successfully!");
        setShowProductForm(false);
        setEditingProduct(null);
        setProductForm({
          name: "",
          category: "",
          price: "",
          description: "",
          stock: "",
          image: "",
        });
        loadProducts();
      } else {
        const error = await response.json();
        alert("Error: " + (error.message || "Failed to save product"));
      }
    } catch (error) {
      console.error("Error saving product:", error);
      alert("Failed to save product");
    }
  };

  // Edit product
  const handleEditProduct = (product) => {
    setEditingProduct(product);
    setProductForm({
      name: product.name,
      category: product.category,
      price: product.price,
      description: product.description,
      stock: product.stock,
      image: product.image || "",
    });
    setShowProductForm(true);
  };

  // Delete product
  const handleDeleteProduct = async (id) => {
    if (confirm("Are you sure you want to delete this product?")) {
      try {
        const response = await fetch(`http://localhost:5002/api/products/${id}`, {
          method: "DELETE",
          headers: getAuthHeaders(),
        });

        if (response.ok) {
          alert("Product deleted successfully!");
          loadProducts();
        } else {
          alert("Failed to delete product");
        }
      } catch (error) {
        console.error("Error deleting product:", error);
        alert("Failed to delete product");
      }
    }
  };

  // Toggle user status
  const handleToggleUserStatus = async (userId, currentStatus) => {
    try {
      const response = await fetch(
        `http://localhost:5001/api/admin/users/${userId}/status`,
        {
          method: "PATCH",
          headers: getAuthHeaders(),
          body: JSON.stringify({ isActive: !currentStatus }),
        }
      );

      const data = await response.json();
      if (data.success) {
        alert(data.message);
        loadUsers();
      } else {
        alert("Failed to update user status");
      }
    } catch (error) {
      console.error("Error updating user status:", error);
      alert("Failed to update user status");
    }
  };

  // Toggle admin status
  const handleToggleAdminStatus = async (userId, currentStatus) => {
    try {
      const response = await fetch(
        `http://localhost:5001/api/admin/users/${userId}/admin`,
        {
          method: "PATCH",
          headers: getAuthHeaders(),
          body: JSON.stringify({ isAdmin: !currentStatus }),
        }
      );

      const data = await response.json();
      if (data.success) {
        alert(data.message);
        loadUsers();
      } else {
        alert("Failed to update admin status");
      }
    } catch (error) {
      console.error("Error updating admin status:", error);
      alert("Failed to update admin status");
    }
  };

  // Delete user
  const handleDeleteUser = async (userId) => {
    if (confirm("Are you sure you want to delete this user?")) {
      try {
        const response = await fetch(
          `http://localhost:5001/api/admin/users/${userId}`,
          {
            method: "DELETE",
            headers: getAuthHeaders(),
          }
        );

        const data = await response.json();
        if (data.success) {
          alert(data.message);
          loadUsers();
        } else {
          alert("Failed to delete user");
        }
      } catch (error) {
        console.error("Error deleting user:", error);
        alert("Failed to delete user");
      }
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Admin Dashboard</h1>

      {/* Tabs */}
      <div className="flex gap-4 mb-8 border-b">
        <button
          className={`px-6 py-3 font-semibold ${
            activeTab === "products"
              ? "border-b-2 border-blue-500 text-blue-500"
              : "text-gray-600"
          }`}
          onClick={() => setActiveTab("products")}
        >
          Products Management
        </button>
        <button
          className={`px-6 py-3 font-semibold ${
            activeTab === "users"
              ? "border-b-2 border-blue-500 text-blue-500"
              : "text-gray-600"
          }`}
          onClick={() => setActiveTab("users")}
        >
          Users Management
        </button>
      </div>

      {/* Products Tab */}
      {activeTab === "products" && (
        <div>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold">Products</h2>
            <button
              onClick={() => {
                setShowProductForm(true);
                setEditingProduct(null);
                setProductForm({
                  name: "",
                  category: "",
                  price: "",
                  description: "",
                  stock: "",
                  image: "",
                });
              }}
              className="bg-blue-500 text-white px-6 py-2 rounded hover:bg-blue-600"
            >
              Add New Product
            </button>
          </div>

          {/* Product Form */}
          {showProductForm && (
            <div className="bg-gray-100 p-6 rounded-lg mb-6">
              <h3 className="text-xl font-bold mb-4">
                {editingProduct ? "Edit Product" : "Create New Product"}
              </h3>
              <form onSubmit={handleProductSubmit} className="space-y-4">
                <div>
                  <label className="block mb-2 font-semibold">Name</label>
                  <input
                    type="text"
                    name="name"
                    value={productForm.name}
                    onChange={handleProductFormChange}
                    required
                    className="w-full p-2 border rounded"
                  />
                </div>
                <div>
                  <label className="block mb-2 font-semibold">Category</label>
                  <input
                    type="text"
                    name="category"
                    value={productForm.category}
                    onChange={handleProductFormChange}
                    required
                    className="w-full p-2 border rounded"
                  />
                </div>
                <div>
                  <label className="block mb-2 font-semibold">Price</label>
                  <input
                    type="number"
                    name="price"
                    value={productForm.price}
                    onChange={handleProductFormChange}
                    required
                    className="w-full p-2 border rounded"
                  />
                </div>
                <div>
                  <label className="block mb-2 font-semibold">Stock</label>
                  <input
                    type="number"
                    name="stock"
                    value={productForm.stock}
                    onChange={handleProductFormChange}
                    required
                    className="w-full p-2 border rounded"
                  />
                </div>
                <div>
                  <label className="block mb-2 font-semibold">Description</label>
                  <textarea
                    name="description"
                    value={productForm.description}
                    onChange={handleProductFormChange}
                    required
                    rows="4"
                    className="w-full p-2 border rounded"
                  ></textarea>
                </div>
                <div>
                  <label className="block mb-2 font-semibold">Image</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="w-full p-2 border rounded"
                  />
                  {productForm.image && (
                    <img
                      src={productForm.image}
                      alt="Preview"
                      className="mt-2 w-32 h-32 object-cover rounded"
                    />
                  )}
                </div>
                <div className="flex gap-4">
                  <button
                    type="submit"
                    className="bg-green-500 text-white px-6 py-2 rounded hover:bg-green-600"
                  >
                    {editingProduct ? "Update Product" : "Create Product"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowProductForm(false);
                      setEditingProduct(null);
                    }}
                    className="bg-gray-500 text-white px-6 py-2 rounded hover:bg-gray-600"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Products List */}
          <div className="overflow-x-auto">
            <table className="w-full bg-white shadow-md rounded">
              <thead className="bg-gray-200">
                <tr>
                  <th className="p-3 text-left">Image</th>
                  <th className="p-3 text-left">Name</th>
                  <th className="p-3 text-left">Category</th>
                  <th className="p-3 text-left">Price</th>
                  <th className="p-3 text-left">Stock</th>
                  <th className="p-3 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <tr key={product._id} className="border-t">
                    <td className="p-3">
                      {product.image && (
                        <img
                          src={product.image}
                          alt={product.name}
                          className="w-16 h-16 object-cover rounded"
                        />
                      )}
                    </td>
                    <td className="p-3">{product.name}</td>
                    <td className="p-3">{product.category}</td>
                    <td className="p-3">${product.price}</td>
                    <td className="p-3">{product.stock}</td>
                    <td className="p-3">
                      <button
                        onClick={() => handleEditProduct(product)}
                        className="bg-yellow-500 text-white px-3 py-1 rounded mr-2 hover:bg-yellow-600"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteProduct(product._id)}
                        className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Users Tab */}
      {activeTab === "users" && (
        <div>
          <h2 className="text-2xl font-bold mb-6">Users</h2>
          <div className="overflow-x-auto">
            <table className="w-full bg-white shadow-md rounded">
              <thead className="bg-gray-200">
                <tr>
                  <th className="p-3 text-left">Username</th>
                  <th className="p-3 text-left">Email</th>
                  <th className="p-3 text-left">Status</th>
                  <th className="p-3 text-left">Role</th>
                  <th className="p-3 text-left">Created At</th>
                  <th className="p-3 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user._id} className="border-t">
                    <td className="p-3">{user.username}</td>
                    <td className="p-3">{user.email}</td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-1 rounded text-sm ${
                          user.isActive
                            ? "bg-green-100 text-green-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {user.isActive ? "Active" : "Disabled"}
                      </span>
                    </td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-1 rounded text-sm ${
                          user.isAdmin
                            ? "bg-blue-100 text-blue-800"
                            : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {user.isAdmin ? "Admin" : "User"}
                      </span>
                    </td>
                    <td className="p-3">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                    <td className="p-3">
                      <button
                        onClick={() =>
                          handleToggleUserStatus(user._id, user.isActive)
                        }
                        className={`px-3 py-1 rounded mr-2 text-white ${
                          user.isActive
                            ? "bg-orange-500 hover:bg-orange-600"
                            : "bg-green-500 hover:bg-green-600"
                        }`}
                      >
                        {user.isActive ? "Disable" : "Enable"}
                      </button>
                      <button
                        onClick={() =>
                          handleToggleAdminStatus(user._id, user.isAdmin)
                        }
                        className={`px-3 py-1 rounded mr-2 text-white ${
                          user.isAdmin
                            ? "bg-purple-500 hover:bg-purple-600"
                            : "bg-blue-500 hover:bg-blue-600"
                        }`}
                      >
                        {user.isAdmin ? "Remove Admin" : "Make Admin"}
                      </button>
                      <button
                        onClick={() => handleDeleteUser(user._id)}
                        className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
