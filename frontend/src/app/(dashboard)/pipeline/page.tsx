export default function PipelinePage() {
  return (
    <div
      className="min-h-full px-6 py-10 md:px-10 max-w-[1600px] mx-auto text-[#fcfcfc]"
      style={{ backgroundColor: "#050505" }}
    >
      <div className="flex flex-col gap-2 mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Pipeline</h1>
        <p className="text-sm text-[#94a3b8]">Coming soon.</p>
      </div>

      <div className="flex items-center justify-center h-[50vh]">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 rounded-full border border-white/10 bg-white/[0.03] flex items-center justify-center mx-auto">
            <svg
              className="w-5 h-5 text-[#64748b]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 6v6m0 0v6m0-6h6m-6 0H6"
              />
            </svg>
          </div>
          <p className="text-sm text-[#64748b]">
            Pipeline is reserved for future plans.
          </p>
        </div>
      </div>
    </div>
  );
}
