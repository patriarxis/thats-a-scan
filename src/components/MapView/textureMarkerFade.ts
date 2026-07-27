import type { Map as MapLibreMap } from "maplibre-gl";
import { getTextureId, type TextureFeature } from "@/domain/textures/types";
import { MARKER_FADE_DURATION_MS } from "./mapViewConstants";

type VisibleMarkerState = "default" | "small";

type FadeTrack = {
  current: number;
  target: number;
  displayState: VisibleMarkerState;
  snapshot: TextureFeature;
};

const isVisibleMarkerState = (state: unknown): state is VisibleMarkerState =>
  state === "default" || state === "small";

const withMarkerFade = (
  feature: TextureFeature,
  markerState: VisibleMarkerState | "hidden",
  fade: number,
): TextureFeature => ({
  ...feature,
  properties: {
    ...feature.properties,
    __marker_state: markerState,
    __marker_fade: fade,
  },
});

export class TextureMarkerFadeAnimator {
  private tracks = new Map<string, FadeTrack>();
  private rafId: number | null = null;
  private lastFrameMs = 0;
  private hasSynced = false;
  private latestTarget: TextureFeature[] = [];
  private neverFadeOutIds = new Set<string>();
  private emit: ((features: TextureFeature[]) => void) | null = null;

  dispose(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.tracks.clear();
    this.emit = null;
  }

  sync(
    targetFeatures: TextureFeature[],
    onEmit: (features: TextureFeature[]) => void,
    neverFadeOutIds: ReadonlySet<string> = new Set(),
  ): void {
    this.latestTarget = targetFeatures;
    this.neverFadeOutIds = new Set(neverFadeOutIds);
    this.emit = onEmit;

    const targetById = new Map<string, TextureFeature>();
    for (const feature of targetFeatures) {
      targetById.set(getTextureId(feature), feature);
    }

    const skipFadeIn = !this.hasSynced;
    this.hasSynced = true;

    for (const feature of targetFeatures) {
      const id = getTextureId(feature);
      const state = feature.properties.__marker_state;
      const track = this.tracks.get(id);
      const keepVisible = neverFadeOutIds.has(id);

      if (isVisibleMarkerState(state) || keepVisible) {
        const displayState: VisibleMarkerState = isVisibleMarkerState(state) ? state : "small";
        if (!track) {
          this.tracks.set(id, {
            current: skipFadeIn || keepVisible ? 1 : 0,
            target: 1,
            displayState,
            snapshot: feature,
          });
          continue;
        }
        track.target = 1;
        track.displayState = displayState;
        track.snapshot = feature;
        if (skipFadeIn || keepVisible) track.current = 1;
        continue;
      }

      if (keepVisible) {
        if (!track) {
          this.tracks.set(id, { current: 1, target: 1, displayState: "small", snapshot: feature });
        } else {
          track.target = 1;
          track.current = 1;
          track.displayState = "small";
          track.snapshot = feature;
        }
        continue;
      }

      if (track && (track.current > 0.01 || track.target > 0)) {
        track.target = 0;
        continue;
      }
      this.tracks.delete(id);
    }

    for (const [id, track] of this.tracks) {
      if (!targetById.has(id) && !neverFadeOutIds.has(id)) track.target = 0;
    }

    this.emitMerged();
    if (this.needsAnimation()) this.scheduleFrame();
    else this.stopFrame();
  }

  private needsAnimation(): boolean {
    for (const track of this.tracks.values()) {
      if (Math.abs(track.current - track.target) > 0.01) return true;
    }
    return false;
  }

  private stopFrame(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.lastFrameMs = 0;
  }

  private scheduleFrame(): void {
    if (this.rafId !== null) return;
    this.lastFrameMs = 0;
    const step = (now: number) => {
      const prev = this.lastFrameMs || now;
      this.lastFrameMs = now;
      const dt = Math.min(now - prev, 32);
      const stepSize = dt / MARKER_FADE_DURATION_MS;
      let animating = false;

      for (const [id, track] of this.tracks) {
        if (track.current < track.target) track.current = Math.min(track.target, track.current + stepSize);
        else if (track.current > track.target) track.current = Math.max(track.target, track.current - stepSize);

        if (Math.abs(track.current - track.target) > 0.01) animating = true;
        else {
          track.current = track.target;
          if (track.target === 0) this.tracks.delete(id);
        }
      }

      this.emitMerged();
      if (animating) this.rafId = requestAnimationFrame(step);
      else {
        this.rafId = null;
        this.lastFrameMs = 0;
      }
    };
    this.rafId = requestAnimationFrame(step);
  }

  private emitMerged(): void {
    if (!this.emit) return;
    const out: TextureFeature[] = [];
    const written = new Set<string>();

    for (const feature of this.latestTarget) {
      const id = getTextureId(feature);
      const track = this.tracks.get(id);
      const state = feature.properties.__marker_state;

      if (track && track.current > 0.01 && state === "hidden") {
        out.push(withMarkerFade(track.snapshot, track.displayState, track.current));
        written.add(id);
        continue;
      }
      if (isVisibleMarkerState(state)) {
        out.push(withMarkerFade(feature, state, track?.current ?? 1));
        written.add(id);
        continue;
      }
      if (this.neverFadeOutIds.has(id)) {
        out.push(withMarkerFade(feature, track?.displayState ?? "small", track?.current ?? 1));
        written.add(id);
        continue;
      }
      out.push(withMarkerFade(feature, "hidden", 0));
      written.add(id);
    }

    for (const [id, track] of this.tracks) {
      if (written.has(id) || track.current <= 0.01) continue;
      out.push(withMarkerFade(track.snapshot, track.displayState, track.current));
    }

    this.emit(out);
  }
}
