import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Auth from "./pages/Auth";
import Configure from "./pages/Configure";
import Interview from "./pages/Interview";
import Report from "./pages/Report";
import Dashboard from "./pages/Dashboard";
import FaceSetup from "./pages/FaceSetup";
import FaceVerify from "./pages/FaceVerify";
import AccountSettings from "./pages/AccountSettings";
import RecruiterDashboard from "./pages/RecruiterDashboard";

function isLoggedIn() {
  return !!localStorage.getItem("token");
}

function PrivateRoute({ children }) {
  return isLoggedIn() ? children : <Navigate to="/" />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Auth />} />
        <Route path="/configure" element={<PrivateRoute><Configure /></PrivateRoute>} />
        <Route path="/face-setup" element={<PrivateRoute><FaceSetup /></PrivateRoute>} />
        <Route path="/face-verify" element={<PrivateRoute><FaceVerify /></PrivateRoute>} />
        <Route path="/interview/:id" element={<PrivateRoute><Interview /></PrivateRoute>} />
        <Route path="/report/:id" element={<PrivateRoute><Report /></PrivateRoute>} />
        <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
        <Route path="/account" element={<PrivateRoute><AccountSettings /></PrivateRoute>} />
        <Route path="/recruiter" element={<PrivateRoute><RecruiterDashboard /></PrivateRoute>} />
      </Routes>
    </BrowserRouter>
  );
}
