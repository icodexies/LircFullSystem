import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { LoginProvider } from "./context/loginContext";
import { AuthProvider } from "./context/AuthContext";
import { PublicOnlyRoute, PrivateRoute } from "./routes/guards";
import { ACCESS } from "./routes/roles";

import PublicLayout from "./layouts/PublicLayout";
import MemberLayout from "./layouts/MemberLayout";
import Home from "./pages/PublicPages/HomePage/Home";

const Register = lazy(() => import("./pages/PublicPages/RegisterPage/Register"));
const MemberHome = lazy(() => import("./pages/PrivatePages/MemberHome"));
const Unauthorized = lazy(() => import("./pages/Unauthorized"));

function PageLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center text-sm text-slate-600" role="status">
      Loading page...
    </div>
  );
}

function App() {
  return (
    <LoginProvider>
      <AuthProvider>
        <BrowserRouter>
          <Suspense fallback={<PageLoading />}>
            <Routes>
              {/* Logged-out only: logged-in users are redirected to /home */}
              <Route element={<PublicOnlyRoute />}>
                <Route element={<PublicLayout />}>
                  <Route path="/" element={<Home />} />
                </Route>
                <Route path="/register" element={<Register />} />
              </Route>

              {/* Open to everyone */}
              <Route path="/unauthorized" element={<Unauthorized />} />

              {/* Any logged-in user */}
              <Route element={<PrivateRoute allowedRoles={ACCESS.member} />}>
                <Route element={<MemberLayout />}>
                  <Route path="/home" element={<MemberHome />} />
                  {/* <Route path="/profile" element={<Profile />} /> */}
                </Route>
              </Route>

              {/* Role-restricted: add pages here later */}
              <Route element={<PrivateRoute allowedRoles={ACCESS.staff} />}>
                <Route element={<MemberLayout />}>
                  {/* <Route path="/manage-books" element={<ManageBooks />} /> */}
                </Route>
              </Route>
            </Routes>
          </Suspense>
        </BrowserRouter>
      </AuthProvider>
    </LoginProvider>
  );
}

export default App;
