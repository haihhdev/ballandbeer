"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Toast from "@/components/Toast";

export default function AdminPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("products");
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [orders, setOrders] = useState([]);
  const [orderStatistics, setOrderStatistics] = useState(null);

  // Products state
  const [products, setProducts] = useState([]);
  const [showProductForm, setShowProductForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Users state
  const [users, setUsers] = useState([]);

  // Product form state
  const [productForm, setProductForm] = useState({
    name: "",
    category: "",
    price: "",
    description: "",
    quantity: "",
    image: "",
  });

  // Show toast notification
  const showToast = (message, type = "success") => {
    setToast({ message, type });
  };

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
      const response = await fetch("/api/products");
      const data = await response.json();

      // Format products with full image URLs
      const formattedProducts = data.map((product) => ({
        ...product,
        image: product.image
          ? `https://raw.githubusercontent.com/haihhdev/ballandbeer-image/refs/heads/main/Ballandbeeritem/${product.image}`
          : null,
      }));

      setProducts(formattedProducts);
    } catch (error) {
      console.error("Error loading products:", error);
      showToast("Failed to load products", "error");
    }
  };

  // Load users
  const loadUsers = async () => {
    try {
      const response = await fetch("/api/admin/users", {
        headers: getAuthHeaders(),
      });
      const data = await response.json();
      if (data.success) {
        setUsers(data.data);
      }
    } catch (error) {
      console.error("Error loading users:", error);
      showToast("Failed to load users", "error");
    }
  };

  // Load orders
  const loadOrders = async () => {
    try {
      const response = await fetch("/api/admin/orders", {
        headers: getAuthHeaders(),
      });
      const data = await response.json();
      if (data.success) {
        setOrders(data.data);
      }
    } catch (error) {
      console.error("Error loading orders:", error);
      showToast("Failed to load orders", "error");
    }
  };

  // Load order statistics
  const loadOrderStatistics = async () => {
    try {
      const response = await fetch("/api/admin/orders/statistics", {
        headers: getAuthHeaders(),
      });
      const data = await response.json();
      if (data.success) {
        setOrderStatistics(data.data);
      }
    } catch (error) {
      console.error("Error loading order statistics:", error);
      showToast("Failed to load order statistics", "error");
    }
  };

  useEffect(() => {
    // Check if user is admin
    const userData = localStorage.getItem("userData");
    if (userData) {
      const user = JSON.parse(userData);
      if (user.isAdmin) {
        setIsAdmin(true);
        loadProducts();
        loadUsers();
        loadOrders();
        loadOrderStatistics();
      } else {
        router.push("/");
      }
    } else {
      router.push("/login");
    }
    setLoading(false);
  }, [router]);

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
        ? `/api/products/${editingProduct._id}`
        : "/api/products";

      const method = editingProduct ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: getAuthHeaders(),
        body: JSON.stringify(productForm),
      });

      if (response.ok) {
        showToast(
          editingProduct
            ? "Product updated successfully!"
            : "Product created successfully!",
          "success"
        );
        setShowProductForm(false);
        setEditingProduct(null);
        setProductForm({
          name: "",
          category: "",
          price: "",
          description: "",
          quantity: "",
          image: "",
        });
        loadProducts();
      } else {
        const error = await response.json();
        showToast(error.message || "Failed to save product", "error");
      }
    } catch (error) {
      console.error("Error saving product:", error);
      showToast("Failed to save product", "error");
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
      quantity: product.quantity,
      image: product.image || "",
    });
    setShowProductForm(true);
  };

  // Delete product
  const handleDeleteProduct = async (id) => {
    if (confirm("Are you sure you want to delete this product?")) {
      try {
        const response = await fetch(`/api/products/${id}`, {
          method: "DELETE",
          headers: getAuthHeaders(),
        });

        if (response.ok) {
          showToast("Product deleted successfully!", "success");
          loadProducts();
        } else {
          showToast("Failed to delete product", "error");
        }
      } catch (error) {
        console.error("Error deleting product:", error);
        showToast("Failed to delete product", "error");
      }
    }
  };

  // Toggle user status
  const handleToggleUserStatus = async (userId, currentStatus) => {
    try {
      const response = await fetch(`/api/admin/users/${userId}/status`, {
        method: "PATCH",
        headers: getAuthHeaders(),
        body: JSON.stringify({ isActive: !currentStatus }),
      });

      const data = await response.json();
      if (data.success) {
        showToast(data.message, "success");
        loadUsers();
      } else {
        showToast("Failed to update user status", "error");
      }
    } catch (error) {
      console.error("Error updating user status:", error);
      showToast("Failed to update user status", "error");
    }
  };

  // Toggle admin status
  const handleToggleAdminStatus = async (userId, currentStatus) => {
    try {
      const response = await fetch(`/api/admin/users/${userId}/admin`, {
        method: "PATCH",
        headers: getAuthHeaders(),
        body: JSON.stringify({ isAdmin: !currentStatus }),
      });

      const data = await response.json();
      if (data.success) {
        showToast(data.message, "success");
        loadUsers();
      } else {
        showToast("Failed to update admin status", "error");
      }
    } catch (error) {
      console.error("Error updating admin status:", error);
      showToast("Failed to update admin status", "error");
    }
  };

  // Delete user
  const handleDeleteUser = async (userId) => {
    if (confirm("Are you sure you want to delete this user?")) {
      try {
        const response = await fetch(`/api/admin/users/${userId}`, {
          method: "DELETE",
          headers: getAuthHeaders(),
        });

        const data = await response.json();
        if (data.success) {
          showToast(data.message, "success");
          loadUsers();
        } else {
          showToast("Failed to delete user", "error");
        }
      } catch (error) {
        console.error("Error deleting user:", error);
        showToast("Failed to delete user", "error");
      }
    }
  };

  // Update order status
  const handleUpdateOrderStatus = async (orderId, newStatus) => {
    try {
      const response = await fetch(`/api/admin/orders/${orderId}/status`, {
        method: "PATCH",
        headers: getAuthHeaders(),
        body: JSON.stringify({ status: newStatus }),
      });

      const data = await response.json();
      if (data.success) {
        showToast(data.message, "success");
        loadOrders();
      } else {
        showToast("Failed to update order status", "error");
      }
    } catch (error) {
      console.error("Error updating order status:", error);
      showToast("Failed to update order status", "error");
    }
  };

  // Delete order
  const handleDeleteOrder = async (orderId) => {
    if (confirm("Are you sure you want to delete this order?")) {
      try {
        const response = await fetch(`/api/admin/orders/${orderId}`, {
          method: "DELETE",
          headers: getAuthHeaders(),
        });

        const data = await response.json();
        if (data.success) {
          showToast(data.message, "success");
          loadOrders();
        } else {
          showToast("Failed to delete order", "error");
        }
      } catch (error) {
        console.error("Error deleting order:", error);
        showToast("Failed to delete order", "error");
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
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-yellow-50 to-amber-50">
      {/* Toast Notification */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {/* Header */}
      <div className="bg-white shadow-sm border-b-2 border-orange-400">
        <div className="container mx-auto px-6 py-6">
          <h1 className="text-4xl font-bold text-gray-800">
            <span className="text-orange-600">Ball & Beer</span> Admin Dashboard
          </h1>
          <p className="text-gray-600 mt-2">Manage your products and users</p>
        </div>
      </div>

      <div className="container mx-auto px-6 py-8">
        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-sm mb-8 p-2 flex gap-2">
          <button
            className={`flex-1 px-6 py-3 font-semibold rounded-md transition-all ${
              activeTab === "products"
                ? "bg-orange-500 text-white shadow-md"
                : "text-gray-600 hover:bg-orange-50"
            }`}
            onClick={() => setActiveTab("products")}
          >
            Products Management
          </button>
          <button
            className={`flex-1 px-6 py-3 font-semibold rounded-md transition-all ${
              activeTab === "users"
                ? "bg-orange-500 text-white shadow-md"
                : "text-gray-600 hover:bg-orange-50"
            }`}
            onClick={() => setActiveTab("users")}
          >
            Users Management
          </button>
          <button
            className={`flex-1 px-6 py-3 font-semibold rounded-md transition-all ${
              activeTab === "orders"
                ? "bg-orange-500 text-white shadow-md"
                : "text-gray-600 hover:bg-orange-50"
            }`}
            onClick={() => setActiveTab("orders")}
          >
            Orders Summary
          </button>
        </div>
        {/* Products Tab */}
        {activeTab === "products" && (
          <div>
            <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-bold text-gray-800">Products</h2>
                  <p className="text-gray-600 mt-1">
                    Manage your product catalog
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowProductForm(true);
                    setEditingProduct(null);
                    setProductForm({
                      name: "",
                      category: "",
                      price: "",
                      description: "",
                      quantity: "",
                      image: "",
                    });
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  className="bg-orange-500 text-white px-6 py-3 rounded-lg font-semibold hover:bg-orange-600 transition-colors shadow-md"
                >
                  + Add New Product
                </button>
              </div>
            </div>

            {/* Category Filter */}
            <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
              <div className="flex items-center flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCategory("all");
                    setCurrentPage(1);
                  }}
                  className={`text-[#5c3613] border border-white hover:border-orange-500 rounded-full text-base font-medium px-5 py-2.5 text-center transition-colors ${
                    selectedCategory === "all"
                      ? "bg-orange-500 text-white border-2 border-orange-500"
                      : ""
                  }`}
                >
                  Tất cả
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCategory("other");
                    setCurrentPage(1);
                  }}
                  className={`text-[#5c3613] border border-white hover:border-orange-500 rounded-full text-base font-medium px-5 py-2.5 text-center transition-colors ${
                    selectedCategory === "other"
                      ? "bg-orange-500 text-white border-2 border-orange-500"
                      : ""
                  }`}
                >
                  Đồ ăn & Thức uống
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCategory("jersey");
                    setCurrentPage(1);
                  }}
                  className={`text-[#5c3613] border border-white hover:border-orange-500 rounded-full text-base font-medium px-5 py-2.5 text-center transition-colors ${
                    selectedCategory === "jersey"
                      ? "bg-orange-500 text-white border-2 border-orange-500"
                      : ""
                  }`}
                >
                  Quần áo
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCategory("shoes");
                    setCurrentPage(1);
                  }}
                  className={`text-[#5c3613] border border-white hover:border-orange-500 rounded-full text-base font-medium px-5 py-2.5 text-center transition-colors ${
                    selectedCategory === "shoes"
                      ? "bg-orange-500 text-white border-2 border-orange-500"
                      : ""
                  }`}
                >
                  Giày
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCategory("accessory");
                    setCurrentPage(1);
                  }}
                  className={`text-[#5c3613] border border-white hover:border-orange-500 rounded-full text-base font-medium px-5 py-2.5 text-center transition-colors ${
                    selectedCategory === "accessory"
                      ? "bg-orange-500 text-white border-2 border-orange-500"
                      : ""
                  }`}
                >
                  Phụ kiện
                </button>
              </div>
            </div>

            {/* Product Form */}
            {showProductForm && (
              <div className="bg-white rounded-lg shadow-md p-8 mb-8 border-2 border-orange-200">
                <h3 className="text-2xl font-bold mb-6 text-gray-800">
                  {editingProduct ? "Edit Product" : "Create New Product"}
                </h3>
                <form onSubmit={handleProductSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block mb-2 font-semibold text-gray-700">
                        Product Name
                      </label>
                      <input
                        type="text"
                        name="name"
                        value={productForm.name}
                        onChange={handleProductFormChange}
                        required
                        className="w-full p-3 border-2 border-gray-200 rounded-lg focus:border-orange-500 focus:outline-none transition-colors"
                        placeholder="Enter product name"
                      />
                    </div>
                    <div>
                      <label className="block mb-2 font-semibold text-gray-700">
                        Category
                      </label>
                      <input
                        type="text"
                        name="category"
                        value={productForm.category}
                        onChange={handleProductFormChange}
                        required
                        className="w-full p-3 border-2 border-gray-200 rounded-lg focus:border-orange-500 focus:outline-none transition-colors"
                        placeholder="e.g., Equipment, Beverage"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block mb-2 font-semibold text-gray-700">
                        Price (VND)
                      </label>
                      <input
                        type="number"
                        name="price"
                        value={productForm.price}
                        onChange={handleProductFormChange}
                        required
                        className="w-full p-3 border-2 border-gray-200 rounded-lg focus:border-orange-500 focus:outline-none transition-colors"
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="block mb-2 font-semibold text-gray-700">
                        Stock Quantity
                      </label>
                      <input
                        type="number"
                        name="quantity"
                        value={productForm.quantity}
                        onChange={handleProductFormChange}
                        required
                        className="w-full p-3 border-2 border-gray-200 rounded-lg focus:border-orange-500 focus:outline-none transition-colors"
                        placeholder="0"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block mb-2 font-semibold text-gray-700">
                      Description
                    </label>
                    <textarea
                      name="description"
                      value={productForm.description}
                      onChange={handleProductFormChange}
                      required
                      rows="4"
                      className="w-full p-3 border-2 border-gray-200 rounded-lg focus:border-orange-500 focus:outline-none transition-colors"
                      placeholder="Describe your product..."
                    ></textarea>
                  </div>

                  <div>
                    <label className="block mb-2 font-semibold text-gray-700">
                      Product Image
                    </label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="w-full p-3 border-2 border-gray-200 rounded-lg focus:border-orange-500 focus:outline-none transition-colors"
                    />
                    {productForm.image && (
                      <div className="mt-4">
                        <img
                          src={productForm.image}
                          alt="Preview"
                          className="w-40 h-40 object-cover rounded-lg border-2 border-gray-200"
                        />
                      </div>
                    )}
                  </div>

                  <div className="flex gap-4 pt-4">
                    <button
                      type="submit"
                      className="bg-green-500 text-white px-8 py-3 rounded-lg font-semibold hover:bg-green-600 transition-colors shadow-md"
                    >
                      {editingProduct ? "Update Product" : "Create Product"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowProductForm(false);
                        setEditingProduct(null);
                      }}
                      className="bg-gray-300 text-gray-700 px-8 py-3 rounded-lg font-semibold hover:bg-gray-400 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Products List */}
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gradient-to-r from-orange-500 to-amber-500 text-white">
                    <tr>
                      <th className="p-4 text-left font-semibold">Image</th>
                      <th className="p-4 text-left font-semibold">Name</th>
                      <th className="p-4 text-left font-semibold">Category</th>
                      <th className="p-4 text-left font-semibold">Price</th>
                      <th className="p-4 text-left font-semibold">Stock</th>
                      <th className="p-4 text-left font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {(() => {
                      // Filter products by category
                      const filteredProducts =
                        selectedCategory === "all"
                          ? products
                          : products.filter(
                              (p) => p.category === selectedCategory
                            );

                      // Calculate pagination
                      const totalPages = Math.ceil(
                        filteredProducts.length / itemsPerPage
                      );
                      const startIndex = (currentPage - 1) * itemsPerPage;
                      const paginatedProducts = filteredProducts.slice(
                        startIndex,
                        startIndex + itemsPerPage
                      );

                      if (filteredProducts.length === 0) {
                        return (
                          <tr>
                            <td
                              colSpan="6"
                              className="p-8 text-center text-gray-500"
                            >
                              No products found. Click "Add New Product" to
                              create one.
                            </td>
                          </tr>
                        );
                      }

                      return paginatedProducts.map((product) => (
                        <tr
                          key={product._id}
                          className="hover:bg-orange-50 transition-colors"
                        >
                          <td className="p-4">
                            {product.image && (
                              <img
                                src={product.image}
                                alt={product.name}
                                className="w-16 h-16 object-cover rounded-lg border-2 border-gray-200"
                              />
                            )}
                          </td>
                          <td className="p-4 font-medium text-gray-800">
                            {product.name}
                          </td>
                          <td className="p-4 text-gray-600">
                            {product.category}
                          </td>
                          <td className="p-4 text-gray-800 font-semibold">
                            {product.price.toLocaleString()} VND
                          </td>
                          <td className="p-4">
                            <span
                              className={`px-3 py-1 rounded-full text-sm font-medium ${
                                product.quantity > 10
                                  ? "bg-green-100 text-green-800"
                                  : product.quantity > 0
                                  ? "bg-yellow-100 text-yellow-800"
                                  : "bg-red-100 text-red-800"
                              }`}
                            >
                              {product.quantity}
                            </span>
                          </td>
                          <td className="p-4">
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleEditProduct(product)}
                                className="bg-blue-500 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-600 transition-colors"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDeleteProduct(product._id)}
                                className="bg-red-500 text-white px-4 py-2 rounded-lg font-medium hover:bg-red-600 transition-colors"
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ));
                    })()}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
              {(() => {
                const filteredProducts =
                  selectedCategory === "all"
                    ? products
                    : products.filter((p) => p.category === selectedCategory);
                const totalPages = Math.ceil(
                  filteredProducts.length / itemsPerPage
                );

                if (totalPages <= 1) return null;

                return (
                  <div className="p-4 border-t border-gray-200 flex items-center justify-between">
                    <div className="text-sm text-gray-600">
                      Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
                      {Math.min(
                        currentPage * itemsPerPage,
                        filteredProducts.length
                      )}{" "}
                      of {filteredProducts.length} products
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() =>
                          setCurrentPage((prev) => Math.max(1, prev - 1))
                        }
                        disabled={currentPage === 1}
                        className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                          currentPage === 1
                            ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                            : "bg-orange-500 text-white hover:bg-orange-600"
                        }`}
                      >
                        Previous
                      </button>
                      <div className="flex items-center gap-2">
                        {Array.from(
                          { length: totalPages },
                          (_, i) => i + 1
                        ).map((page) => (
                          <button
                            key={page}
                            onClick={() => setCurrentPage(page)}
                            className={`w-10 h-10 rounded-lg font-medium transition-colors ${
                              currentPage === page
                                ? "bg-orange-500 text-white"
                                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                            }`}
                          >
                            {page}
                          </button>
                        ))}
                      </div>
                      <button
                        onClick={() =>
                          setCurrentPage((prev) =>
                            Math.min(totalPages, prev + 1)
                          )
                        }
                        disabled={currentPage === totalPages}
                        className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                          currentPage === totalPages
                            ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                            : "bg-orange-500 text-white hover:bg-orange-600"
                        }`}
                      >
                        Next
                      </button>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        )}
        {/* Users Tab */}
        {activeTab === "users" && (
          <div>
            <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
              <h2 className="text-2xl font-bold text-gray-800">Users</h2>
              <p className="text-gray-600 mt-1">
                Manage user accounts and permissions
              </p>
            </div>

            <div className="bg-white rounded-lg shadow-md overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gradient-to-r from-orange-500 to-amber-500 text-white">
                    <tr>
                      <th className="p-4 text-left font-semibold">Username</th>
                      <th className="p-4 text-left font-semibold">Email</th>
                      <th className="p-4 text-left font-semibold">Status</th>
                      <th className="p-4 text-left font-semibold">Role</th>
                      <th className="p-4 text-left font-semibold">
                        Created At
                      </th>
                      <th className="p-4 text-left font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {users.length === 0 ? (
                      <tr>
                        <td
                          colSpan="6"
                          className="p-8 text-center text-gray-500"
                        >
                          No users found.
                        </td>
                      </tr>
                    ) : (
                      users.map((user) => (
                        <tr
                          key={user._id}
                          className="hover:bg-orange-50 transition-colors"
                        >
                          <td className="p-4 font-medium text-gray-800">
                            {user.username}
                          </td>
                          <td className="p-4 text-gray-600">{user.email}</td>
                          <td className="p-4">
                            <span
                              className={`px-3 py-1 rounded-full text-sm font-medium ${
                                user.isActive
                                  ? "bg-green-100 text-green-800"
                                  : "bg-red-100 text-red-800"
                              }`}
                            >
                              {user.isActive ? "Active" : "Disabled"}
                            </span>
                          </td>
                          <td className="p-4">
                            <span
                              className={`px-3 py-1 rounded-full text-sm font-medium ${
                                user.isAdmin
                                  ? "bg-blue-100 text-blue-800"
                                  : "bg-gray-100 text-gray-800"
                              }`}
                            >
                              {user.isAdmin ? "Admin" : "User"}
                            </span>
                          </td>
                          <td className="p-4 text-gray-600">
                            {new Date(user.createdAt).toLocaleDateString()}
                          </td>
                          <td className="p-4">
                            <div className="flex gap-2 flex-wrap">
                              <button
                                onClick={() =>
                                  handleToggleUserStatus(
                                    user._id,
                                    user.isActive
                                  )
                                }
                                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                                  user.isActive
                                    ? "bg-orange-500 text-white hover:bg-orange-600"
                                    : "bg-green-500 text-white hover:bg-green-600"
                                }`}
                              >
                                {user.isActive ? "Disable" : "Enable"}
                              </button>
                              <button
                                onClick={() =>
                                  handleToggleAdminStatus(
                                    user._id,
                                    user.isAdmin
                                  )
                                }
                                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                                  user.isAdmin
                                    ? "bg-purple-500 text-white hover:bg-purple-600"
                                    : "bg-blue-500 text-white hover:bg-blue-600"
                                }`}
                              >
                                {user.isAdmin ? "Remove Admin" : "Make Admin"}
                              </button>
                              <button
                                onClick={() => handleDeleteUser(user._id)}
                                className="bg-red-500 text-white px-4 py-2 rounded-lg font-medium hover:bg-red-600 transition-colors"
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
        {/* Orders Tab */}
        {activeTab === "orders" && (
          <div>
            <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
              <h2 className="text-2xl font-bold text-gray-800">
                Orders Summary
              </h2>
              <p className="text-gray-600 mt-1">
                Overview of all customer purchases
              </p>
            </div>

            {/* Statistics Cards */}
            {orderStatistics && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
                {/* Total Orders */}
                <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-blue-500">
                  <div className="flex items-center">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-600">
                        Total Orders
                      </p>
                      <p className="text-2xl font-bold text-gray-900">
                        {orderStatistics.totalOrders}
                      </p>
                    </div>
                    <div className="text-blue-500">
                      <svg
                        className="w-8 h-8"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* Monthly Revenue */}
                <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-green-500">
                  <div className="flex items-center">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-600">
                        Monthly Revenue
                      </p>
                      <p className="text-2xl font-bold text-gray-900">
                        {orderStatistics.monthlyRevenue.toLocaleString()} VND
                      </p>
                    </div>
                    <div className="text-green-500">
                      <svg
                        className="w-8 h-8"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1"
                        />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* Weekly Revenue */}
                <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-purple-500">
                  <div className="flex items-center">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-600">
                        Weekly Revenue
                      </p>
                      <p className="text-2xl font-bold text-gray-900">
                        {orderStatistics.weeklyRevenue.toLocaleString()} VND
                      </p>
                    </div>
                    <div className="text-purple-500">
                      <svg
                        className="w-8 h-8"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                        />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* Unique Customers */}
                <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-orange-500">
                  <div className="flex items-center">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-600">
                        Customers
                      </p>
                      <p className="text-2xl font-bold text-gray-900">
                        {orderStatistics.uniqueCustomers}
                      </p>
                    </div>
                    <div className="text-orange-500">
                      <svg
                        className="w-8 h-8"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z"
                        />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* Completion Rate */}
                <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-red-500">
                  <div className="flex items-center">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-600">
                        Completion Rate
                      </p>
                      <p className="text-2xl font-bold text-gray-900">
                        {orderStatistics.completionRate}%
                      </p>
                      <p className="text-xs text-gray-500">
                        {orderStatistics.completedOrders} completed /{" "}
                        {orderStatistics.pendingOrders} pending
                      </p>
                    </div>
                    <div className="text-red-500">
                      <svg
                        className="w-8 h-8"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Top Products */}
            {orderStatistics &&
              orderStatistics.topProducts &&
              orderStatistics.topProducts.length > 0 && (
                <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">
                    Top Selling Products
                  </h3>
                  <div className="space-y-3">
                    {orderStatistics.topProducts
                      .slice(0, 3)
                      .map((product, index) => (
                        <div
                          key={product._id}
                          className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-orange-500 text-white rounded-full flex items-center justify-center text-sm font-bold">
                              {index + 1}
                            </div>
                            <div>
                              <p className="font-medium text-gray-800">
                                Product {product._id}
                              </p>
                              <p className="text-sm text-gray-600">
                                {product.totalQuantity} units sold
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-gray-800">
                              {product.totalRevenue.toLocaleString()} VND
                            </p>
                            <p className="text-sm text-gray-600">Revenue</p>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}

            <div className="bg-white rounded-lg shadow-md overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gradient-to-r from-orange-500 to-amber-500 text-white">
                    <tr>
                      <th className="p-4 text-left font-semibold">Order ID</th>
                      <th className="p-4 text-left font-semibold">Customer</th>
                      <th className="p-4 text-left font-semibold">Items</th>
                      <th className="p-4 text-left font-semibold">
                        Total Amount (VND)
                      </th>
                      <th className="p-4 text-left font-semibold">
                        Payment Method
                      </th>
                      <th className="p-4 text-left font-semibold">Status</th>
                      <th className="p-4 text-left font-semibold">Date</th>
                      <th className="p-4 text-left font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {orders.length === 0 ? (
                      <tr>
                        <td
                          colSpan="8"
                          className="p-8 text-center text-gray-500"
                        >
                          No orders found.
                        </td>
                      </tr>
                    ) : (
                      orders.map((order) => (
                        <tr
                          key={order._id}
                          className="hover:bg-orange-50 transition-colors"
                        >
                          <td className="p-4 font-medium text-gray-800">
                            {order._id}
                          </td>
                          <td className="p-4 text-gray-700">
                            {order.user?.username || "N/A"}
                          </td>
                          <td className="p-4">
                            <div className="space-y-2">
                              {order.items?.map((item, index) => (
                                <div
                                  key={index}
                                  className="flex items-center gap-3"
                                >
                                  {item.image && (
                                    <img
                                      src={item.image}
                                      alt={item.name}
                                      className="w-12 h-12 object-cover rounded-lg border border-gray-200"
                                    />
                                  )}
                                  <div>
                                    <div className="font-medium text-gray-800">
                                      {item.name}
                                    </div>
                                    <div className="text-sm text-gray-600">
                                      Quantity: {item.quantity} | Price:{" "}
                                      {item.price.toLocaleString()} VND
                                    </div>
                                    <div className="text-xs text-gray-500">
                                      Category: {item.category}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </td>
                          <td className="p-4 text-gray-800 font-semibold">
                            {order.totalPrice?.toLocaleString()} VND
                          </td>
                          <td className="p-4">
                            <span className="px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                              {order.paymentMethod || "Cash"}
                            </span>
                          </td>
                          <td className="p-4">
                            <span
                              className={`px-3 py-1 rounded-full text-sm font-medium ${
                                order.status === "completed"
                                  ? "bg-green-100 text-green-800"
                                  : order.status === "pending"
                                  ? "bg-yellow-100 text-yellow-800"
                                  : "bg-gray-100 text-gray-700"
                              }`}
                            >
                              {order.status}
                            </span>
                          </td>
                          <td className="p-4 text-gray-600">
                            {new Date(order.createdAt).toLocaleDateString()}
                          </td>
                          <td className="p-4">
                            <div className="flex gap-2 flex-wrap">
                              <button
                                onClick={() =>
                                  handleUpdateOrderStatus(
                                    order._id,
                                    order.status === "complete"
                                      ? "pending"
                                      : "complete"
                                  )
                                }
                                className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                                  order.status === "complete"
                                    ? "bg-yellow-500 text-white hover:bg-yellow-600"
                                    : "bg-green-500 text-white hover:bg-green-600"
                                }`}
                              >
                                {order.status === "complete"
                                  ? "Mark Pending"
                                  : "Mark Complete"}
                              </button>
                              <button
                                onClick={() => handleDeleteOrder(order._id)}
                                className="bg-red-500 text-white px-3 py-1 rounded-lg text-sm font-medium hover:bg-red-600 transition-colors"
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}