import { Routes, Route } from "react-router-dom";
import NavBar from "./components/NavBar";
import Home from "./pages/Home";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import OwnerDashboard from "./pages/OwnerDashboard";
import AddProperty from "./pages/AddProperty";
import PGDetail from "./pages/PGDetail";
import Roommates from "./pages/Roommates";
import Logo from "./components/Logo";

export default function App() {
  return (
    <>
      <NavBar />
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/owner" element={<OwnerDashboard />} />
          <Route path="/owner/add" element={<AddProperty />} />
          <Route path="/pg/:id" element={<PGDetail />} />
          <Route path="/roommates" element={<Roommates />} />
        </Routes>
      </main>
      <footer className="fn-footer py-5">
        <div className="container">
          <div className="d-flex justify-content-between flex-wrap gap-3">
            <div>
              <Logo size={34} light />
              <div className="mt-2 small">
                Find a PG · Compare facilities · Match with roommates · Track rent
              </div>
            </div>
            <div className="small text-end">
              Made with care for students
              <br />
              myNest · 2026
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}
