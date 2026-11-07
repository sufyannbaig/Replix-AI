/**
 * Builders for GenerationRequest.inputs, so each studio's Generate call records exactly
 * what the user picked in a shape the server can turn into a prompt.
 */
import type { GenerationInputs, PieceOption, PieceRef, UploadRef } from "./types";

type Uploaded = { name: string; url: string; isVideo?: boolean };

export function pieceRef(piece: PieceOption): PieceRef {
  return { id: piece.id, kind: piece.kind, name: piece.name, imageUrl: piece.imageUrl };
}

export function uploadRef(file: Uploaded): UploadRef;
export function uploadRef(file: Uploaded | null): UploadRef | null;
export function uploadRef(file: Uploaded | null): UploadRef | null {
  return file ? { name: file.name, url: file.url, isVideo: file.isVideo } : null;
}

type PhotoPieces = {
  scene: PieceOption | null;
  props: PieceOption[];
  character: PieceOption | null;
  pose: PieceOption | null;
};
type PhotoDiy = {
  scene: Uploaded | null;
  props: Uploaded[];
  character: Uploaded | null;
  pose: Uploaded | null;
};

/** Photo Studio has three modes; returns undefined until the mode's required pick is made. */
export function photoInputs(
  mode: "templates" | "piece" | "diy",
  picks: { templateId: string | null; pieces: PhotoPieces; diy: PhotoDiy },
): GenerationInputs | undefined {
  if (mode === "piece") {
    const { scene, props, character, pose } = picks.pieces;
    return scene
      ? {
          studio: "photo",
          mode,
          scene: pieceRef(scene),
          props: props.map(pieceRef),
          character: character && pieceRef(character),
          pose: pose && pieceRef(pose),
        }
      : undefined;
  }
  if (mode === "diy") {
    const { scene, props, character, pose } = picks.diy;
    return scene
      ? {
          studio: "photo",
          mode,
          scene: uploadRef(scene),
          props: props.map((p) => uploadRef(p)),
          character: uploadRef(character),
          pose: uploadRef(pose),
        }
      : undefined;
  }
  return picks.templateId
    ? { studio: "photo", mode: "templates", templateId: picks.templateId }
    : undefined;
}
