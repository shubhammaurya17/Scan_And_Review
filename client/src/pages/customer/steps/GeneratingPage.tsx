export function GeneratingPage() {
  return (
    <div className="text-center py-20">
      <div className="relative mx-auto w-16 h-16 mb-6">
        <div className="absolute inset-0 rounded-full border-4 border-primary-200" />
        <div className="absolute inset-0 rounded-full border-4 border-primary-600 border-t-transparent animate-spin" />
      </div>
      <h2 className="text-xl font-bold text-gray-900 mb-2">Crafting Your Reviews...</h2>
      <p className="text-gray-500 text-sm">AI is creating personalized review drafts based on your feedback</p>
    </div>
  );
}
