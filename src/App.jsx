import DialogProvider from "./context/dialogs/DialogProvider.jsx";
import ToastProvider from "./context/toasts/ToastProvider.jsx";
import ThemeProvider from "./context/theme/ThemeProvider.jsx";
import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { LoadingScreen } from "./components/ui/Loading.jsx";
import { LoginProvider } from "./context/login/loginContext.jsx";
import { AuthProvider } from "./context/auth/AuthContext.jsx";
import { PublicOnlyRoute, PrivateRoute } from "./routes/guards.jsx";
import { ACCESS } from "./routes/roles.js";
import { MEMBER_PAGES } from "./routes/memberPages.js";
import { MEMBER_SCREENS } from "./routes/memberScreens.js";
import PublicLayout from "./layouts/public/PublicLayout.jsx";
import Home from "./pages/PublicPages/HomePage/Home.jsx";

const Register = lazy(
  () => import("./pages/PublicPages/RegisterPage/Register.jsx"),
);
const ForgotPassword = lazy(
  () => import("./pages/PublicPages/ForgotPasswordPage/ForgotPassword.jsx"),
);
const ResetPassword = lazy(
  () => import("./pages/PublicPages/ResetPasswordPage/ResetPassword.jsx"),
);
const MemberLayout = lazy(() => import("./layouts/member/MemberLayout.jsx"));
const NotificationsPage = lazy(
  () => import("./pages/PrivatePages/Notifications/Notifications.jsx"),
);
const ProfilePage = lazy(
  () => import("./pages/PrivatePages/Profile/Profile.jsx"),
);
const Unauthorized = lazy(() => import("./pages/Unauthorized.jsx"));
const SettingsPage = lazy(
  () => import("./pages/PrivatePages/Settings/Settings.jsx"),
);
const SystemStationPage = lazy(
  () => import("./pages/SystemStation/SystemStation.jsx"),
);

const memberScreens = MEMBER_SCREENS;

export default function App() {
  return (
    <ThemeProvider>
      <LoginProvider>
        <AuthProvider>
          <BrowserRouter>
          <ToastProvider>
          <DialogProvider>
            <Suspense fallback={<LoadingScreen label="Loading page…" />}>
              <Routes>
                <Route element={<PublicOnlyRoute />}>
                  <Route element={<PublicLayout />}>
                    <Route path="/" element={<Home />} />
                  </Route>
                  <Route path="/register" element={<Register />} />
                  <Route path="/forgot-password" element={<ForgotPassword />} />
                </Route>

                <Route path="/unauthorized" element={<Unauthorized />} />
                {/* Opens from the emailed reset link; must work signed in or out. */}
                <Route path="/reset-password" element={<ResetPassword />} />

                {/* The system stations: shared accounts for automated use by
                    students in the library (borrowing / attendance). */}
                <Route element={<PrivateRoute allowedRoles={ACCESS.systemStations} />}>
                  <Route path="/system" element={<SystemStationPage />} />
                </Route>

                <Route element={<PrivateRoute allowedRoles={ACCESS.member} />}>
                  <Route element={<MemberLayout />}>
                    {/* Preserve the existing post-login URL. */}
                    <Route
                      path="/home"
                      element={<Navigate to="/dashboard" replace />}
                    />
                    {/* Bell and header shortcuts — not sidebar pages. */}
                    <Route
                      path="/notifications"
                      element={<NotificationsPage />}
                    />
                    <Route path="/profile" element={<ProfilePage />} />
                    <Route element={<PrivateRoute allowedRoles={ACCESS.books} />}>
                      <Route path="/settings" element={<SettingsPage />} />
                    </Route>
                    {MEMBER_PAGES.map((page) => {
                      const Screen = memberScreens[page.id];
                      return (
                        <Route
                          key={page.id}
                          element={
                            <PrivateRoute allowedRoles={page.allowedRoles} />
                          }
                        >
                          <Route path={page.path} element={<Screen />} />
                        </Route>
                      );
                    })}
                  </Route>
                </Route>

                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
          </DialogProvider>
          </ToastProvider>
        </BrowserRouter>
        </AuthProvider>
      </LoginProvider>
    </ThemeProvider>
  );
}
