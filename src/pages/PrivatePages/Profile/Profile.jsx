// The signed-in member's own profile — the same layout for every role;
// fields that do not apply show a dash. Includes the profile photo: upload
// your own image or pick one of the library's defaults.
import { useEffect, useState } from "react";
import {
  getMyProfile,
  setMyAvatar,
  uploadMyAvatar,
} from "../../../services/auth/authService.js";
import { getMyValidationStatus } from "../../../services/validation/onlineValidationService.js";
import { useAuth } from "../../../hooks/auth/useAuth.js";
import { useToast } from "../../../hooks/shared/useToast.js";
import { ROLE_LABELS } from "../../../routes/roles.js";
import { PROFILE_AVATAR_OPTIONS } from "../../../data/profileAvatars.js";
import {
  WorkspaceHeader,
  WorkspaceNotice,
  secondaryButton,
} from "../../../components/attendance/WorkspaceUi.jsx";
import { buttonClass } from "../../../components/attendance/StaffUi.jsx";
import { panelClass } from "../../../components/personnel/panel.js";
import { LoadingBlock } from "../../../components/ui/Loading.jsx";
import Avatar from "../../../components/ui/Avatar.jsx";
import LibraryCard from "../../../components/profile/LibraryCard.jsx";
import ProfileValidation, {
  ValidationBadge,
} from "../../../components/profile/ProfileValidation.jsx";

const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX_BYTES = 2 * 1024 * 1024;

export default function Profile() {
  const toast = useToast();
  const { refreshProfile } = useAuth();
  const [state, setState] = useState({ loading: true, error: "", data: null });
  const [validation, setValidation] = useState({
    loading: true,
    error: "",
    data: null,
  });
  const [photoBusy, setPhotoBusy] = useState(false);
  const [pendingSrc, setPendingSrc] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    getMyProfile(controller.signal)
      .then(async (data) => {
        if (!active) return;
        // Show the card and profile immediately; validation loads beside it.
        setState({ loading: false, error: "", data });
        let nextValidation = { loading: false, error: "", data: null };
        if (data.role === "student") {
          try {
            const status = await getMyValidationStatus(controller.signal);
            nextValidation = { loading: false, error: "", data: status };
          } catch (error) {
            if (error?.name === "AbortError") return;
            nextValidation = {
              loading: false,
              error: error.message,
              data: null,
            };
          }
        }
        if (!active) return;
        setValidation(nextValidation);
      })
      .catch((error) => {
        if (active && error?.name !== "AbortError") {
          setState({ loading: false, error: error.message, data: null });
          setValidation({ loading: false, error: "", data: null });
        }
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, []);

  async function refreshValidation() {
    try {
      const status = await getMyValidationStatus();
      setValidation({ loading: false, error: "", data: status });
    } catch (error) {
      setValidation({ loading: false, error: error.message, data: null });
    }
  }

  const data = state.data;
  const fields = [
    ["Library ID", data?.library_id],
    ["Role", data ? (ROLE_LABELS[data.role] ?? data.role) : ""],
    ["Department", data?.department],
    ["Program", data?.program],
    ["Position", data?.position],
    ["Email", data?.email],
  ];

  function applyAvatar(avatarUrl) {
    setState((current) =>
      current.data ? { ...current, data: { ...current.data, avatar_url: avatarUrl } } : current,
    );
    // The header reads the session profile — refresh it so the photo follows.
    refreshProfile();
  }

  async function chooseAvatar(url) {
    if (photoBusy) return;
    setPhotoBusy(true);
    setPendingSrc(url ?? "");
    try {
      const next = await setMyAvatar(url ?? "");
      applyAvatar(next);
      toast.success(url ? "Profile photo updated." : "Profile photo removed.");
    } catch (error) {
      toast.error(error.message, "Photo not saved");
    } finally {
      setPhotoBusy(false);
      setPendingSrc(null);
    }
  }

  async function pickFile(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || photoBusy) return;
    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast.error("Choose a PNG, JPG or WebP image.", "Photo not saved");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("The image is larger than 2 MB.", "Photo not saved");
      return;
    }
    setPhotoBusy(true);
    setPendingSrc("upload");
    try {
      const publicUrl = await uploadMyAvatar(file);
      const next = await setMyAvatar(publicUrl);
      applyAvatar(next);
      toast.success("Profile photo updated.");
    } catch (error) {
      toast.error(error.message, "Upload failed");
    } finally {
      setPhotoBusy(false);
      setPendingSrc(null);
    }
  }

  return (
    <div className="space-y-6">
      <WorkspaceHeader
        title="Your profile"
        description="Your library card, validation status, account information, and profile photo."
      >
        {data && <span>{ROLE_LABELS[data.role] ?? data.role} account</span>}
      </WorkspaceHeader>

      {state.error && <WorkspaceNotice error>{state.error}</WorkspaceNotice>}

      {data && (
        <div
          className={`grid gap-5 ${
            data.role === "student"
              ? "xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]"
              : ""
          }`}
        >
          <section className={panelClass}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-ink">
                  Library card
                </h2>
                <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                  Your printable library card. The barcode uses the same
                  library ID the scanner reads.
                </p>
              </div>
              <button
                type="button"
                className={`${secondaryButton} no-print`}
                onClick={() => window.print()}
              >
                Print card
              </button>
            </div>
            <div className="mt-4">
              <LibraryCard profile={data} validation={validation.data} />
            </div>
            <p className="mt-3 text-[10px] leading-relaxed text-slate-500">
              Print at 100% / actual size, then cut along the edge and laminate.
            </p>
          </section>

          {data.role === "student" && (
            <ProfileValidation
              status={validation.data}
              loading={validation.loading}
              error={validation.error}
              onChanged={refreshValidation}
            />
          )}
        </div>
      )}

      <section className={panelClass}>
        {state.loading ? (
          <LoadingBlock
            label="Loading your profile…"
            className="min-h-[12rem]"
          />
        ) : data ? (
          <>
            <div className="flex flex-wrap items-center gap-5">
              <Avatar src={data.avatar_url} className="h-24 w-24" />
              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-semibold text-ink">
                  {data.full_name}
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  {ROLE_LABELS[data.role] ?? data.role} · {data.library_id}
                </p>
                {data.role === "student" && validation.data && (
                  <ValidationBadge
                    state={validation.data.state}
                    className="mt-2"
                  />
                )}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <label
                    className={`${buttonClass} cursor-pointer ${
                      photoBusy ? "pointer-events-none opacity-60" : ""
                    }`}
                  >
                    {photoBusy && pendingSrc === "upload"
                      ? "Uploading…"
                      : "Upload photo"}
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="sr-only"
                      disabled={photoBusy}
                      onChange={pickFile}
                    />
                  </label>
                  {data.avatar_url && (
                    <button
                      type="button"
                      className={secondaryButton}
                      disabled={photoBusy}
                      onClick={() => chooseAvatar("")}
                    >
                      Remove photo
                    </button>
                  )}
                </div>
                <p className="mt-2 text-[11px] text-slate-500">
                  PNG, JPG or WebP up to 2 MB. Without a photo the library
                  default image is shown.
                </p>
              </div>
            </div>

            <div className="mt-6 border-t border-slate-100 pt-5">
              <h3 className="text-xs font-semibold text-ink">
                Or choose a default
              </h3>
              <p className="mt-1 text-[11px] text-slate-500">
                Pick one of the library's images — you can change it anytime.
              </p>
              <div className="mt-3 flex flex-wrap gap-3">
                {PROFILE_AVATAR_OPTIONS.map((option) => {
                  const active = data.avatar_url === option.src;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      disabled={photoBusy}
                      onClick={() => chooseAvatar(option.src)}
                      title={option.label}
                      aria-label={`Use ${option.label}`}
                      aria-pressed={active}
                      className={`relative h-14 w-14 overflow-hidden rounded-full border-2 transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong disabled:opacity-60 ${
                        active
                          ? "border-jade"
                          : "border-slate-200 hover:border-accent-strong/50"
                      }`}
                    >
                      <img
                        src={option.src}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        className="h-full w-full object-cover"
                      />
                      {active && (
                        <span
                          className="absolute right-0.5 top-0.5 grid h-4 w-4 place-items-center rounded-full bg-jade text-[9px] font-bold text-white"
                          aria-hidden="true"
                        >
                          ✓
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <dl className="mt-6 grid gap-x-8 gap-y-5 border-t border-slate-100 pt-6 sm:grid-cols-2 lg:grid-cols-3">
              {fields.map(([label, value]) => (
                <div key={label} className="min-w-0">
                  <dt className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
                    {label}
                  </dt>
                  <dd className="mt-1 break-words text-sm text-ink">
                    {value || "—"}
                  </dd>
                </div>
              ))}
            </dl>
          </>
        ) : null}
      </section>
    </div>
  );
}
