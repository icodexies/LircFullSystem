
import { BrowserRouter, Routes, Route } from "react-router-dom";
import PublicLayout from "./layouts/PublicLayout";
import Home from "./pages/PublicPages/HomePage/Home";
import { LoginProvider } from "./context/loginContext";
function app(){
  return(
    <LoginProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<PublicLayout />}>
            <Route path="/" element={<Home />}></Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </LoginProvider>

  );
}
export default app;