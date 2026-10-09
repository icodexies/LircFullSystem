import { useEffect, useRef, useState } from "react";
import { prepareCoverImage } from "../../../services/coverImage.js";

export default function CoverUpload({ onChange, onBusy }) {
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState("");
  const [preparing, setPreparing] = useState(false);
  const selection = useRef(0);
  useEffect(
    () => () => {
      selection.current++;
    },
    [],
  );
  useEffect(() => {
    if (!preview) return;
    return () => URL.revokeObjectURL(preview.url);
  }, [preview]);

  async function choose(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const current = ++selection.current;
    setPreparing(true);
    onBusy(true);
    setError("");
    try {
      const blob = await prepareCoverImage(file);
      if (current !== selection.current) return;
      setPreview({
        url: URL.createObjectURL(blob),
        name: file.name,
        size: blob.size,
      });
      onChange(blob);
    } catch (error) {
      if (current === selection.current) setError(error.message);
    } finally {
      if (current === selection.current) {
        setPreparing(false);
        onBusy(false);
      }
    }
  }
  function clear() {
    selection.current++;
    setPreview(null);
    setError("");
    setPreparing(false);
    onChange(null);
    onBusy(false);
  }
  return (
    <div className="rounded-xl border border-dashed border-[#3B4A86]/30 bg-[#F7F6FB] p-4">
      <label className="block text-xs font-medium text-slate-600">
        Upload a book cover
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={preparing}
          onChange={choose}
          className="mt-3 block w-full text-xs file:mr-3 file:rounded-lg file:border-0 file:bg-[#0B1330] file:px-3 file:py-2 file:text-white"
        />
      </label>
      <p className="mt-2 text-xs text-slate-500">
        JPG, PNG or WebP, up to 10 MB. Saved as a smaller cover when you save
        changes.
      </p>
      {preparing && (
        <p role="status" className="mt-2 text-xs text-slate-600">
          Preparing cover...
        </p>
      )}
      {error && (
        <p role="alert" className="mt-2 text-xs text-red-700">
          {error}
        </p>
      )}
      {preview && (
        <div className="mt-3 flex items-center gap-3">
          <img
            src={preview.url}
            alt="Selected cover preview"
            className="h-24 w-16 rounded-lg object-contain"
          />
          <div className="min-w-0 text-xs text-slate-600">
            <p className="break-all">{preview.name}</p>
            <p className="mt-1">{Math.ceil(preview.size / 1024)} KB prepared</p>
            <button
              type="button"
              onClick={clear}
              className="mt-2 font-semibold text-[#3B4A86]"
            >
              Remove selected upload
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
