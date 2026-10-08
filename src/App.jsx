import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { LoginProvider } from "./context/loginContext";
import { AuthProvider } from "./context/AuthContext";
import { PublicOnlyRoute, PrivateRoute } from "./routes/guards";
import { ACCESS } from "./routes/roles";
import { MEMBER_PAGES } from "./routes/memberPages";
import PublicLayout from "./layouts/PublicLayout";
import Home from "./pages/PublicPages/HomePage/Home";

const Register = lazy(() => import("./pages/PublicPages/RegisterPage/Register"));
const MemberLayout = lazy(() => import("./layouts/MemberLayout"));
const Unauthorized = lazy(() => import("./pages/Unauthorized"));

const memberScreens = {
  dashboard: lazy(() => import("./pages/PrivatePages/Dashboard/Dashboard")),
  opac: lazy(() => import("./pages/PrivatePages/OPAC/OPAC")),
  "path-finder": lazy(() => import("./pages/PrivatePages/PathFinder/PathFinder")),
  statistics: lazy(() => import("./pages/PrivatePages/Statistics/Statistics")),
  attendance: lazy(() => import("./pages/PrivatePages/Attendance/Attendance")),
  "barcode-generator": lazy(() => import("./pages/PrivatePages/BarcodeGenerator/BarcodeGenerator")),
  "book-borrow": lazy(() => import("./pages/PrivatePages/BookBorrow/BookBorrow")),
  inventory: lazy(() => import("./pages/PrivatePages/Inventory/Inventory")),
  "adding-books": lazy(() => import("./pages/PrivatePages/AddingBooks/AddingBooks")),
};

function PageLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center text-sm text-slate-600" role="status">
      Loading page...
    </div>
  );
}

export default function App() {
  return (
    <LoginProvider>
      <AuthProvider>
        <BrowserRouter>
          <Suspense fallback={<PageLoading />}>
            <Routes>
              <Route element={<PublicOnlyRoute />}>
                <Route element={<PublicLayout />}>
                  <Route path="/" element={<Home />} />
                </Route>
                <Route path="/register" element={<Register />} />
              </Route>

              <Route path="/unauthorized" element={<Unauthorized />} />

              <Route element={<PrivateRoute allowedRoles={ACCESS.member} />}>
                <Route element={<MemberLayout />}>
                  {/* Preserve the existing post-login URL. */}
                  <Route path="/home" element={<Navigate to="/dashboard" replace />} />
                  {MEMBER_PAGES.map((page) => {
                    const Screen = memberScreens[page.id];
                    return (
                      <Route key={page.id} element={<PrivateRoute allowedRoles={page.allowedRoles} />}>
                        <Route path={page.path} element={<Screen />} />
                      </Route>
                    );
                  })}
                </Route>
              </Route>

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </AuthProvider>
    </LoginProvider>
  );
}
