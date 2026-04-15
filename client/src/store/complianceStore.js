import { create } from "zustand";

const useComplianceStore = create((set) => ({
  // Mode 1 — Extracted requirements
  requirements: [],
  setRequirements: (reqs) => set({ requirements: reqs }),
  clearRequirements: () => set({ requirements: [] }),

  // Category filter
  activeFilter: "All",
  setActiveFilter: (filter) => set({ activeFilter: filter }),

  // Mode 2 — Validation results
  validationData: null,
  setValidationData: (data) => set({ validationData: data }),
  clearValidationData: () => set({ validationData: null }),

  // Global loading state
  loading: false,
  setLoading: (val) => set({ loading: val }),

  // Error
  error: null,
  setError: (err) => set({ error: err }),
  clearError: () => set({ error: null }),

  // Reset everything
  reset: () =>
    set({
      requirements: [],
      activeFilter: "All",
      validationData: null,
      loading: false,
      error: null,
    }),
}));

export default useComplianceStore;
