import { Suspense, lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

import StoreLayout from './layouts/StoreLayout.jsx';
import AccountLayout from './layouts/AccountLayout.jsx';
import AdminLayout from './layouts/AdminLayout.jsx';
import RouteFallback from './components/layout/RouteFallback.jsx';
import { RequireAdmin, RequireAuth } from './components/layout/RouteGuards.jsx';

const Home = lazy(() => import('./pages/public/Home.jsx'));
const Shop = lazy(() => import('./pages/public/Shop.jsx'));
const Search = lazy(() => import('./pages/public/Search.jsx'));
const Category = lazy(() => import('./pages/public/Category.jsx'));
const ProductDetail = lazy(() => import('./pages/public/ProductDetail.jsx'));
const Cart = lazy(() => import('./pages/public/Cart.jsx'));
const Checkout = lazy(() => import('./pages/public/Checkout.jsx'));
const OrderConfirmed = lazy(() => import('./pages/public/OrderConfirmed.jsx'));
const Login = lazy(() => import('./pages/public/Login.jsx'));
const Register = lazy(() => import('./pages/public/Register.jsx'));
const ForgotPassword = lazy(() => import('./pages/public/ForgotPassword.jsx'));
const About = lazy(() => import('./pages/public/About.jsx'));
const Contact = lazy(() => import('./pages/public/Contact.jsx'));
const TrackOrder = lazy(() => import('./pages/public/TrackOrder.jsx'));
const NotFound = lazy(() => import('./pages/public/NotFound.jsx'));

const AccountOverview = lazy(() => import('./pages/account/Overview.jsx'));
const MyOrders = lazy(() => import('./pages/account/MyOrders.jsx'));
const OrderDetails = lazy(() => import('./pages/account/OrderDetails.jsx'));
const OrderTracking = lazy(() => import('./pages/account/OrderTracking.jsx'));
const Wishlist = lazy(() => import('./pages/account/Wishlist.jsx'));
const Addresses = lazy(() => import('./pages/account/Addresses.jsx'));
const Profile = lazy(() => import('./pages/account/Profile.jsx'));
const AccountSettings = lazy(() => import('./pages/account/Settings.jsx'));

const AdminHome = lazy(() => import('./pages/admin/Home.jsx'));
const AdminOrders = lazy(() => import('./pages/admin/Orders.jsx'));
const AdminOrderDetails = lazy(() => import('./pages/admin/OrderDetails.jsx'));
const AdminProducts = lazy(() => import('./pages/admin/Products.jsx'));
const AdminProductForm = lazy(() => import('./pages/admin/ProductForm.jsx'));
const AdminCategories = lazy(() => import('./pages/admin/Categories.jsx'));
const AdminCustomers = lazy(() => import('./pages/admin/Customers.jsx'));
const AdminShipping = lazy(() => import('./pages/admin/Shipping.jsx'));
const AdminPayments = lazy(() => import('./pages/admin/Payments.jsx'));
const AdminAnalytics = lazy(() => import('./pages/admin/Analytics.jsx'));
const AdminDiscounts = lazy(() => import('./pages/admin/Discounts.jsx'));
const AdminContent = lazy(() => import('./pages/admin/Content.jsx'));
const AdminMarkets = lazy(() => import('./pages/admin/Markets.jsx'));
const AdminCJSync = lazy(() => import('./pages/admin/CJSync.jsx'));
const AdminSettings = lazy(() => import('./pages/admin/Settings.jsx'));

export default function App() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        {/* ---------------- Storefront ---------------- */}
        <Route element={<StoreLayout />}>
          <Route index element={<Home />} />
          <Route path="shop" element={<Shop />} />
          <Route path="search" element={<Search />} />
          <Route path="category/:slug" element={<Category />} />
          <Route path="product/:slug" element={<ProductDetail />} />
          <Route path="cart" element={<Cart />} />
          <Route path="checkout" element={<Checkout />} />
          <Route path="order-confirmed" element={<OrderConfirmed />} />
          <Route path="track-order" element={<TrackOrder />} />
          <Route path="about" element={<About />} />
          <Route path="contact" element={<Contact />} />
        </Route>

        {/* ---------------- Auth (no chrome) ---------------- */}
        <Route path="login" element={<Login />} />
        <Route path="register" element={<Register />} />
        <Route path="forgot-password" element={<ForgotPassword />} />

        {/* ---------------- Customer account (auth required) ---------------- */}
        <Route
          path="account"
          element={
            <RequireAuth>
              <AccountLayout />
            </RequireAuth>
          }
        >
          <Route index element={<AccountOverview />} />
          <Route path="orders" element={<MyOrders />} />
          <Route path="orders/:orderNumber" element={<OrderDetails />} />
          <Route path="orders/:orderNumber/tracking" element={<OrderTracking />} />
          <Route path="wishlist" element={<Wishlist />} />
          <Route path="addresses" element={<Addresses />} />
          <Route path="profile" element={<Profile />} />
          <Route path="settings" element={<AccountSettings />} />
        </Route>

        {/* ---------------- Admin ----------------
         * Wrapped in RequireAdmin. Without this the whole admin tree was
         * reachable while signed out: every panel rendered its own
         * "cannot reach the API" error instead of sending the visitor to
         * /login. The server refused the data either way, but a route that
         * only ever renders errors is a broken route.
         */}
        <Route
          path="admin"
          element={
            <RequireAdmin>
              <AdminLayout />
            </RequireAdmin>
          }
        >
          <Route index element={<AdminHome />} />
          <Route path="orders" element={<AdminOrders />} />
          <Route path="orders/:orderNumber" element={<AdminOrderDetails />} />
          <Route path="products" element={<AdminProducts />} />
          <Route path="products/new" element={<AdminProductForm />} />
          <Route path="products/:id/edit" element={<AdminProductForm />} />
          <Route path="categories" element={<AdminCategories />} />
          <Route path="customers" element={<AdminCustomers />} />
          <Route path="shipping" element={<AdminShipping />} />
          <Route path="payments" element={<AdminPayments />} />
          <Route path="analytics" element={<AdminAnalytics />} />
          <Route path="discounts" element={<AdminDiscounts />} />
          <Route path="content" element={<AdminContent />} />
          <Route path="markets" element={<AdminMarkets />} />
          <Route path="cj-sync" element={<AdminCJSync />} />
          <Route path="settings" element={<AdminSettings />} />
        </Route>

        <Route path="/products" element={<Navigate to="/shop" replace />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}
