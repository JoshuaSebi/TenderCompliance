import { Routes, Route } from "react-router-dom";
import Landing from "./pages/Landing";
import UploadRFP from "./pages/UploadRFP";
import UploadBoth from "./pages/UploadBoth";
import ChecklistView from "./pages/ChecklistView";
import CompareResults from "./pages/CompareResults";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/upload-rfp" element={<UploadRFP />} />
      <Route path="/upload-both" element={<UploadBoth />} />
      <Route path="/checklist" element={<ChecklistView />} />
      <Route path="/compliance" element={<CompareResults />} />
    </Routes>
  );
}