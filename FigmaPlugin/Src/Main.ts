import { emit, on, showUI } from "@create-figma-plugin/utilities";
import type {
  AuthBundle,
  AuthClearedHandler,
  AuthLoadedHandler,
  AuthStoredHandler,
  BakeProgressHandler,
  BuildPayloadHandler,
  CacheLoadedHandler,
  CacheStoredHandler,
  ClearAuthHandler,
  LoadAuthHandler,
  LoadCacheHandler,
  LoadSettingsHandler,
  NotifyHandler,
  OpenExternalHandler,
  PayloadBuiltHandler,
  PayloadErrorHandler,
  SelectionChangedHandler,
  SettingsLoadedHandler,
  SettingsStoredHandler,
  StoreAuthHandler,
  StoreCacheHandler,
  StoreSettingsHandler,
} from "./Types";
import { WalkSelection } from "./Mappers/Tree";
import { BakeAll } from "./Bake";
import { LoadCache, StoreCache } from "./AssetCache";
import { LoadSettings, StoreSettings } from "./Settings";

const StorageKeys = {
  AccessToken: "FigmaToRoblox.AccessToken",
  RefreshToken: "FigmaToRoblox.RefreshToken",
  ExpiresAt: "FigmaToRoblox.ExpiresAt",
  RobloxUserId: "FigmaToRoblox.RobloxUserId",
  UserName: "FigmaToRoblox.UserName",
} as const;

async function LoadBundle(): Promise<AuthBundle | null> {
  const [AccessToken, RefreshToken, ExpiresAt, RobloxUserId, UserName] = await Promise.all([
    figma.clientStorage.getAsync(StorageKeys.AccessToken),
    figma.clientStorage.getAsync(StorageKeys.RefreshToken),
    figma.clientStorage.getAsync(StorageKeys.ExpiresAt),
    figma.clientStorage.getAsync(StorageKeys.RobloxUserId),
    figma.clientStorage.getAsync(StorageKeys.UserName),
  ]);
  if (typeof AccessToken !== "string" || typeof RefreshToken !== "string" || typeof RobloxUserId !== "string") {
    return null;
  }
  return {
    AccessToken,
    RefreshToken,
    ExpiresAt: typeof ExpiresAt === "number" ? ExpiresAt : 0,
    RobloxUserId,
    UserName: typeof UserName === "string" ? UserName : `user ${RobloxUserId}`,
  };
}

async function StoreBundle(Bundle: AuthBundle): Promise<void> {
  await Promise.all([
    figma.clientStorage.setAsync(StorageKeys.AccessToken, Bundle.AccessToken),
    figma.clientStorage.setAsync(StorageKeys.RefreshToken, Bundle.RefreshToken),
    figma.clientStorage.setAsync(StorageKeys.ExpiresAt, Bundle.ExpiresAt),
    figma.clientStorage.setAsync(StorageKeys.RobloxUserId, Bundle.RobloxUserId),
    figma.clientStorage.setAsync(StorageKeys.UserName, Bundle.UserName),
  ]);
}

async function ClearBundle(): Promise<void> {
  await Promise.all([
    figma.clientStorage.deleteAsync(StorageKeys.AccessToken),
    figma.clientStorage.deleteAsync(StorageKeys.RefreshToken),
    figma.clientStorage.deleteAsync(StorageKeys.ExpiresAt),
    figma.clientStorage.deleteAsync(StorageKeys.RobloxUserId),
    figma.clientStorage.deleteAsync(StorageKeys.UserName),
  ]);
}

function EmitSelection(): void {
  const Selection = figma.currentPage.selection;
  emit<SelectionChangedHandler>("SELECTION_CHANGED", {
    Count: Selection.length,
    FirstName: Selection.length > 0 ? (Selection[0]?.name ?? null) : null,
  });
}

export default function Main(): void {
  on<LoadAuthHandler>("LOAD_AUTH", async () => {
    const Bundle = await LoadBundle();
    emit<AuthLoadedHandler>("AUTH_LOADED", Bundle);
  });

  on<StoreAuthHandler>("STORE_AUTH", async (Bundle) => {
    await StoreBundle(Bundle);
    emit<AuthStoredHandler>("AUTH_STORED");
  });

  on<ClearAuthHandler>("CLEAR_AUTH", async () => {
    await ClearBundle();
    emit<AuthClearedHandler>("AUTH_CLEARED");
  });

  on<LoadCacheHandler>("LOAD_CACHE", async () => {
    const Cache = await LoadCache();
    emit<CacheLoadedHandler>("CACHE_LOADED", Cache);
  });

  on<StoreCacheHandler>("STORE_CACHE", async (Cache) => {
    await StoreCache(Cache);
    emit<CacheStoredHandler>("CACHE_STORED");
  });

  on<LoadSettingsHandler>("LOAD_SETTINGS", async () => {
    const S = await LoadSettings();
    emit<SettingsLoadedHandler>("SETTINGS_LOADED", S);
  });

  on<StoreSettingsHandler>("STORE_SETTINGS", async (S) => {
    await StoreSettings(S);
    emit<SettingsStoredHandler>("SETTINGS_STORED");
  });

  on<OpenExternalHandler>("OPEN_EXTERNAL", (Url) => {
    figma.openExternal(Url);
  });

  on<BuildPayloadHandler>("BUILD_PAYLOAD", async (Options) => {
    try {
      const BakeTextNodes = Options?.BakeTextNodes ?? true;
      const ExportScale = Options?.ExportScale ?? 2;
      const LayerNameDetection = Options?.LayerNameDetection ?? true;
      const ResponsiveScale = Options?.ResponsiveScale ?? true;
      const { Tree, Stats, BakeJobs, ReferenceFrameSize } = WalkSelection(figma.currentPage.selection, {
        BakeTextNodes,
        LayerNameDetection,
        ResponsiveScale,
      });
      emit<BakeProgressHandler>("BAKE_PROGRESS", { Done: 0, Total: BakeJobs.length });
      const Baked = await BakeAll(BakeJobs, ExportScale, (Done, Total) => {
        emit<BakeProgressHandler>("BAKE_PROGRESS", { Done, Total });
      });
      emit<PayloadBuiltHandler>("PAYLOAD_BUILT", {
        Tree,
        Bakes: Baked,
        NodeCount: Stats.NodeCount,
        ImageCount: Stats.ImageCount,
        ReferenceFrameSize,
      });
    } catch (Err) {
      emit<PayloadErrorHandler>("PAYLOAD_ERROR", (Err as Error).message ?? String(Err));
    }
  });

  on<NotifyHandler>("NOTIFY", (Message) => {
    figma.notify(Message);
  });

  figma.on("selectionchange", EmitSelection);

  showUI({ width: 340, height: 640, themeColors: true });

  EmitSelection();
}
