import { expect, test } from "@playwright/test";
import { Buffer } from "node:buffer";
import { BakeAll } from "../../FigmaPlugin/Src/Bake";
import { ApplyPayloadImageHashes, CollectPayloadAssets, PlanPayloadImages } from "../../FigmaPlugin/Src/PayloadImages";
import { WalkSelection } from "../../FigmaPlugin/Src/Mappers/Tree";
import type { AssetEntry } from "../../FigmaPlugin/Src/Types";
import { CreateSelection, LoadFixtureCases, LoadFixtureScene } from "../Src/FixtureLoader";
import { InstallFigmaShim } from "../Src/FigmaShim";
import { StableJson } from "../Src/Normalize";
import { RenderPreviewHtml } from "../Src/PreviewRenderer";

InstallFigmaShim();

const Cases = LoadFixtureCases();

for (const Case of Cases) {
  if (Case.Visual) {
    test(Case.Name, async ({ page }) => {
      const { Tree, ImagePlan } = await RunFixtureCase(Case);
      if (!Case.Preview) throw new Error(`Fixture "${Case.Name}" is visual but has no Preview config`);
      await page.setViewportSize({ width: Case.Preview.Width, height: Case.Preview.Height });
      await page.setContent(
        RenderPreviewHtml(Tree, {
          Width: Case.Preview.Width,
          Height: Case.Preview.Height,
          Background: Case.Preview.Background,
          AssetsByHash: BuildAssetDataUrls(ImagePlan.HashToBytes),
        }),
      );
      await expect(page.locator("#Stage")).toHaveScreenshot(`${Case.Name}.png`);
    });
  } else {
    test(Case.Name, async () => {
      await RunFixtureCase(Case);
    });
  }
}

async function RunFixtureCase(Case: (typeof Cases)[number]) {
  const Scene = LoadFixtureScene(Case);
  const Selection = CreateSelection(Scene, Case);
  const Result = WalkSelection(Selection, Case.Options ?? {});
  for (const Job of Result.BakeJobs) {
    if (typeof (Job.Node as unknown as { exportAsync?: unknown }).exportAsync !== "function") {
      throw new Error(`Fixture "${Case.Name}" has no exportAsset for baked node "${Job.Name}" (${Job.FigmaId})`);
    }
  }

  const Bakes = await BakeAll(Result.BakeJobs, Case.ExportScale ?? 2);
  const BakedIds = new Set(Bakes.map((Bake) => Bake.FigmaId));
  const MissingBakes = Result.BakeJobs.filter((Job) => !BakedIds.has(Job.FigmaId));
  if (MissingBakes.length > 0) {
    const Missing = MissingBakes.map((Job) => `${Job.Name} (${Job.FigmaId})`).join(", ");
    throw new Error(`Fixture "${Case.Name}" failed to bake: ${Missing}`);
  }

  const ImagePlan = PlanPayloadImages(Bakes, {});
  ApplyPayloadImageHashes(Result.Tree, ImagePlan.FigmaIdToHash);
  const SyntheticAssetCache = BuildSyntheticAssetCache(ImagePlan.UniqueHashes);
  const Assets = CollectPayloadAssets(ImagePlan.UniqueHashes, SyntheticAssetCache);

  expect(
    StableJson({
      Name: Case.Name,
      ReferenceFrameSize: Result.ReferenceFrameSize,
      Stats: Result.Stats,
      BakeHashes: ImagePlan.FigmaIdToHash,
      Assets,
      Tree: Result.Tree,
    }),
  ).toMatchSnapshot(`${Case.Name}.UiNode.json`);

  return { Tree: Result.Tree, ImagePlan };
}

function BuildSyntheticAssetCache(Hashes: readonly string[]): Record<string, AssetEntry> {
  const Out: Record<string, AssetEntry> = {};
  [...Hashes].sort().forEach((Hash, Index) => {
    Out[Hash] = { DecalId: 900000 + Index, ImageId: 1900000 + Index };
  });
  return Out;
}

function BuildAssetDataUrls(HashToBytes: Record<string, Uint8Array>): Record<string, string> {
  const Out: Record<string, string> = {};
  for (const [Hash, Bytes] of Object.entries(HashToBytes)) {
    Out[Hash] = `data:image/png;base64,${Buffer.from(Bytes).toString("base64")}`;
  }
  return Out;
}
