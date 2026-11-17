import JsBarcode from "jsbarcode";
import { FALLBACK_AVATAR } from "../../data/profileAvatars.js";
import { buildLibraryCardModel } from "./libraryCardModel.js";

// Print the wallet-sized card on a long bond sheet: 8.5 x 13 in (215.9 x 330.2 mm).
// The card itself stays at standard ID-1 size (85.6 x 54 mm).
const PAGE_WIDTH = 215.9;
const PAGE_HEIGHT = 330.2;
const CARD_WIDTH = 85.6;
const CARD_HEIGHT = 54;
const CARD_X = (PAGE_WIDTH - CARD_WIDTH) / 2;
const CARD_Y = (PAGE_HEIGHT - CARD_HEIGHT) / 2;
const MARGIN = 4;

const NAVY = [11, 19, 48];
const NAVY_LIGHT = [21, 32, 74];
const ACCENT = [59, 74, 134];
const SKY = [186, 230, 253];
const SLATE = [226, 232, 240];
const WHITE = [255, 255, 255];
const VALIDATED_BG = [167, 243, 208];
const VALIDATED_FG = [6, 78, 59];

const LOGO_LIRC = `${import.meta.env.BASE_URL}images/auth/LIRC_Logo.webp`;
const LOGO_CCC = `${import.meta.env.BASE_URL}images/auth/CCC_Logo.png`;

const X = (value) => CARD_X + value;
const Y = (value) => CARD_Y + value;

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const timer = window.setTimeout(
      () => reject(new Error("Image loading timed out.")),
      5000,
    );

    image.onload = () => {
      window.clearTimeout(timer);
      resolve(image);
    };
    image.onerror = () => {
      window.clearTimeout(timer);
      reject(new Error("Image could not be loaded."));
    };

    image.crossOrigin = "anonymous";
    image.src = src;
  });
}

async function loadLogo(src, maxWidth = 640, maxHeight = 220) {
  const image = await loadImage(src);
  const width = image.naturalWidth || maxWidth;
  const height = image.naturalHeight || maxHeight;
  const scale = Math.min(maxWidth / width, maxHeight / height, 1);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/png");
}

async function loadAvatar(src) {
  const image = await loadImage(src);
  const size = 512;
  const width = image.naturalWidth || size;
  const height = image.naturalHeight || size;
  const scale = Math.max(size / width, size / height);
  const drawWidth = width * scale;
  const drawHeight = height * scale;
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  canvas.width = size;
  canvas.height = size;
  context.save();
  context.beginPath();
  context.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
  context.clip();
  context.drawImage(
    image,
    (size - drawWidth) / 2,
    (size - drawHeight) / 2,
    drawWidth,
    drawHeight,
  );
  context.restore();

  return canvas.toDataURL("image/png");
}

async function loadAvatarWithFallback(profile) {
  const sources = [profile?.avatar_url, FALLBACK_AVATAR].filter(Boolean);
  for (const source of sources) {
    try {
      return await loadAvatar(source);
    } catch {
      // Try the next source, then fall back to initials.
    }
  }
  return null;
}

function makeBarcode(libraryId) {
  const canvas = document.createElement("canvas");
  JsBarcode(canvas, libraryId, {
    format: "CODE39",
    width: 4,
    height: 100,
    displayValue: false,
    margin: 0,
    background: "#ffffff",
    lineColor: "#0b1330",
  });
  return canvas.toDataURL("image/png");
}

function truncateToWidth(doc, value, maxWidth) {
  let text = String(value ?? "").trim();
  if (doc.getTextWidth(text) <= maxWidth) return text;
  while (text.length > 1 && doc.getTextWidth(`${text}...`) > maxWidth) {
    text = text.slice(0, -1);
  }
  return `${text.trimEnd()}...`;
}

function setFittedText(
  doc,
  value,
  { maxWidth, size, minSize = 4, family = "helvetica", weight = "bold" },
) {
  let nextSize = size;
  doc.setFont(family, weight);
  while (nextSize > minSize) {
    doc.setFontSize(nextSize);
    if (doc.getTextWidth(String(value ?? "")) <= maxWidth) break;
    nextSize = Math.max(minSize, nextSize - 0.2);
  }
  doc.setFontSize(nextSize);
  return truncateToWidth(doc, value, maxWidth);
}

function addContainedImage(doc, dataUrl, box) {
  const properties = doc.getImageProperties(dataUrl);
  const ratio = properties.width / properties.height;
  let width = box.width;
  let height = width / ratio;
  if (height > box.height) {
    height = box.height;
    width = height * ratio;
  }
  doc.addImage(
    dataUrl,
    "PNG",
    box.x + (box.width - width) / 2,
    box.y + (box.height - height) / 2,
    width,
    height,
  );
  return { width, height };
}

function initialsFor(name) {
  const parts = String(name ?? "")
    .replaceAll(",", " ")
    .split(/\s+/)
    .filter(Boolean);
  return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase() || "LM";
}

function drawCropMarks(doc) {
  const gap = 2;
  const length = 4;
  const x0 = CARD_X;
  const x1 = CARD_X + CARD_WIDTH;
  const y0 = CARD_Y;
  const y1 = CARD_Y + CARD_HEIGHT;

  doc.setDrawColor(148, 163, 184);
  doc.setLineWidth(0.15);

  // Top-left, top-right, bottom-left and bottom-right corner marks.
  [
    [x0, y0, -1, -1],
    [x1, y0, 1, -1],
    [x0, y1, -1, 1],
    [x1, y1, 1, 1],
  ].forEach(([x, y, dx, dy]) => {
    doc.line(x + dx * gap, y, x + dx * (gap + length), y);
    doc.line(x, y + dy * gap, x, y + dy * (gap + length));
  });
}

export async function downloadLibraryCardPdf(profile, validation) {
  const model = buildLibraryCardModel(profile, validation);
  const [lircLogo, cccLogo, avatar] = await Promise.all([
    loadLogo(LOGO_LIRC, 620, 180).catch(() => null),
    loadLogo(LOGO_CCC, 180, 180).catch(() => null),
    loadAvatarWithFallback(profile),
  ]);
  let barcode = null;
  if (model.libraryId) {
    try {
      barcode = makeBarcode(model.libraryId);
    } catch {
      // The typed ID below the barcode still identifies the card.
    }
  }

  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: [PAGE_WIDTH, PAGE_HEIGHT],
    compress: true,
  });

  doc.setProperties({
    title: `Library card - ${model.fullName}`,
    subject: "LIRC library card",
    author: "CCC Learning Resource Center",
    creator: "LIRC Library System",
  });

  // Long bond sheet.
  doc.setFillColor(...WHITE);
  doc.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT, "F");

  // Card surface.
  doc.setFillColor(...NAVY);
  doc.roundedRect(X(0), Y(0), CARD_WIDTH, CARD_HEIGHT, 3, 3, "F");

  // Keep the decorative shapes inside the rounded card even though the page is
  // now much larger than the card.
  doc.saveGraphicsState();
  doc.roundedRect(X(0), Y(0), CARD_WIDTH, CARD_HEIGHT, 3, 3, null);
  doc.clip();
  doc.discardPath();
  doc.setFillColor(...NAVY_LIGHT);
  doc.circle(X(CARD_WIDTH - 4), Y(2), 17, "F");
  doc.setFillColor(...ACCENT);
  doc.circle(X(-2), Y(CARD_HEIGHT + 2), 12, "F");
  doc.setDrawColor(...SKY);
  doc.setLineWidth(0.18);
  doc.circle(X(CARD_WIDTH - 15), Y(10), 10, "S");
  doc.restoreGraphicsState();

  // Institution logos.
  let logoX = MARGIN;
  if (lircLogo) {
    const placed = addContainedImage(doc, lircLogo, {
      x: X(logoX),
      y: Y(3.4),
      width: 5.6,
      height: 5.4,
    });
    logoX += placed.width + 2.2;
  } else {
    doc.setTextColor(...WHITE);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6);
    doc.text("LIRC", X(logoX), Y(7.4));
    logoX += 10;
  }
  doc.setDrawColor(...ACCENT);
  doc.setLineWidth(0.22);
  doc.line(X(logoX), Y(3.8), X(logoX), Y(8.8));
  logoX += 2.2;
  if (cccLogo) {
    addContainedImage(doc, cccLogo, {
      x: X(logoX),
      y: Y(3.4),
      width: 5.4,
      height: 5.4,
    });
  } else {
    doc.setTextColor(...WHITE);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(5);
    doc.text("CCC", X(logoX), Y(7.4));
  }

  // Validation badge.
  doc.setFont("helvetica", "bold");
  doc.setFontSize(3.8);
  const badgeLabel = model.validated ? "VALIDATED" : "LIBRARY CARD";
  const badgeWidth = Math.max(18, doc.getTextWidth(badgeLabel) + 5);
  const badgeX = CARD_WIDTH - MARGIN - badgeWidth;
  doc.setFillColor(...(model.validated ? VALIDATED_BG : ACCENT));
  doc.roundedRect(X(badgeX), Y(4.2), badgeWidth, 4.5, 2.2, 2.2, "F");
  doc.setTextColor(...(model.validated ? VALIDATED_FG : WHITE));
  doc.text(badgeLabel, X(badgeX + badgeWidth / 2), Y(7.35), {
    align: "center",
  });

  // Cardholder photo and identity.
  const avatarX = MARGIN;
  const avatarY = 13.4;
  const avatarSize = 11;
  if (avatar) {
    doc.addImage(
      avatar,
      "PNG",
      X(avatarX),
      Y(avatarY),
      avatarSize,
      avatarSize,
    );
  } else {
    doc.setFillColor(...ACCENT);
    doc.circle(
      X(avatarX + avatarSize / 2),
      Y(avatarY + avatarSize / 2),
      avatarSize / 2,
      "F",
    );
    doc.setTextColor(...WHITE);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.text(initialsFor(model.fullName), X(avatarX + avatarSize / 2), Y(avatarY + 7.2), {
      align: "center",
    });
  }
  doc.setDrawColor(...WHITE);
  doc.setLineWidth(0.25);
  doc.circle(
    X(avatarX + avatarSize / 2),
    Y(avatarY + avatarSize / 2),
    avatarSize / 2,
    "S",
  );

  const textX = avatarX + avatarSize + 2.6;
  const textWidth = CARD_WIDTH - MARGIN - textX;
  doc.setTextColor(...SKY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(3.2);
  doc.text("CARDHOLDER", X(textX), Y(14.6));

  doc.setTextColor(...WHITE);
  const name = setFittedText(doc, model.fullName, {
    maxWidth: textWidth,
    size: 8.6,
    minSize: 5.8,
  });
  doc.text(name, X(textX), Y(19.2));

  doc.setFont("helvetica", "normal");
  doc.setFontSize(4.2);
  doc.setTextColor(...SLATE);
  const roleLine = truncateToWidth(
    doc,
    [model.roleLabel, model.detail].filter(Boolean).join(" - "),
    textWidth,
  );
  doc.text(roleLine, X(textX), Y(23.2));

  // Library ID and validation period.
  doc.setFont("helvetica", "bold");
  doc.setFontSize(3.2);
  doc.setTextColor(...SKY);
  doc.text("LIBRARY ID", X(MARGIN), Y(31.3));
  doc.setTextColor(...WHITE);
  const idText = setFittedText(doc, model.libraryId || "-", {
    maxWidth: 46,
    size: 6.8,
    minSize: 4.2,
    family: "courier",
  });
  doc.text(idText, X(MARGIN), Y(35.9));

  const period = [model.semesterName, model.academicYearName]
    .filter(Boolean)
    .join(" - ");
  if (model.validated && period) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(3.1);
    doc.setTextColor(...SKY);
    doc.text("VALID THROUGH", X(CARD_WIDTH - MARGIN), Y(31.3), {
      align: "right",
    });
    doc.setTextColor(...WHITE);
    const periodText = setFittedText(doc, period, {
      maxWidth: 28,
      size: 3.8,
      minSize: 2.8,
    });
    doc.text(periodText, X(CARD_WIDTH - MARGIN), Y(35.9), {
      align: "right",
    });
  }

  // Barcode strip.
  const barcodeY = 38.7;
  const barcodeHeight = 11.1;
  doc.setFillColor(...WHITE);
  doc.roundedRect(
    X(MARGIN),
    Y(barcodeY),
    CARD_WIDTH - MARGIN * 2,
    barcodeHeight,
    1.6,
    1.6,
    "F",
  );
  if (barcode) {
    doc.addImage(
      barcode,
      "PNG",
      X(MARGIN + 2),
      Y(barcodeY + 1.35),
      CARD_WIDTH - MARGIN * 2 - 4,
      6.7,
    );
  }
  doc.setFont("courier", "bold");
  doc.setFontSize(3.6);
  doc.setTextColor(...NAVY);
  doc.text(
    `*${model.libraryId}*`,
    X(CARD_WIDTH / 2),
    Y(barcodeY + 10.05),
    { align: "center" },
  );

  drawCropMarks(doc);
  doc.save(model.fileName);
}
