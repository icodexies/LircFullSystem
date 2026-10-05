
import { Outlet } from "react-router-dom";
import NavBar from "../components/layoutComponents/NavBar";
import Footer from "../components/layoutComponents/Footer";


function PublicLayout() {
  return (
    <div className="min-h-screen">
   
        <NavBar />
   
      <main>
        <Outlet />
      </main>

      <Footer />
    </div>  
  );
}

export default PublicLayout;

