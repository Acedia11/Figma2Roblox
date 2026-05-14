import {
  Banner,
  Bold,
  Button,
  Checkbox,
  Container,
  Divider,
  IconChevronDown16,
  IconCheck16,
  IconRefresh16,
  IconWarning16,
  LoadingIndicator,
  Muted,
  Stack,
  Text,
  TextboxNumeric,
  VerticalSpace,
  render,
} from "@create-figma-plugin/ui";
import { emit, on, once } from "@create-figma-plugin/utilities";
import { Fragment, h } from "preact";
import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import {
  BeginSignIn,
  BundleFromTokens,
  EnsureCreatorGrant,
  ExchangeCode,
  FetchUserInfo,
  RefreshTokenExpiredError,
  WaitForCode,
} from "./Auth";
import { DefaultSettings } from "./Settings";
import { AssetUploadBatchError, FormatSkippedAssetsWarning, PushPayload } from "./Sync";
import type {
  AssetEntry,
  AuthBundle,
  AuthClearedHandler,
  AuthLoadedHandler,
  AuthStoredHandler,
  BakeBlob,
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
  Settings,
  SettingsLoadedHandler,
  SettingsStoredHandler,
  StoreAuthHandler,
  StoreCacheHandler,
  StoreSettingsHandler,
  UiNode,
} from "./Types";

type Mode = "Loading" | "SignedOut" | "AwaitingPickup" | "SignedIn" | "Syncing";
type LastSync = {
  Timestamp: string;
  NodeCount: number;
  ImageCount: number;
  Sequence: number;
  UploadCount: number;
  CacheHitCount: number;
  SkippedImageCount: number;
};
type Progress = { Done: number; Total: number };
type RetryStatus = { Name: string; WaitSeconds: number; Reason: string };

const ZeroProgress: Progress = { Done: 0, Total: 0 };

function AwaitAck<Handler extends { name: string; handler: () => void }>(Name: Handler["name"], EmitRequest: () => void): Promise<void> {
  return new Promise((Resolve) => {
    once<Handler>(Name, () => Resolve());
    EmitRequest();
  });
}

function StoreAuthAndAwait(Bundle: AuthBundle): Promise<void> {
  return AwaitAck<AuthStoredHandler>("AUTH_STORED", () => emit<StoreAuthHandler>("STORE_AUTH", Bundle));
}

function ClearAuthAndAwait(): Promise<void> {
  return AwaitAck<AuthClearedHandler>("AUTH_CLEARED", () => emit<ClearAuthHandler>("CLEAR_AUTH"));
}

function StoreCacheAndAwait(Cache: Record<string, AssetEntry>): Promise<void> {
  return AwaitAck<CacheStoredHandler>("CACHE_STORED", () => emit<StoreCacheHandler>("STORE_CACHE", Cache));
}

function StoreSettingsAndAwait(S: Settings): Promise<void> {
  return AwaitAck<SettingsStoredHandler>("SETTINGS_STORED", () => emit<StoreSettingsHandler>("STORE_SETTINGS", S));
}

function BuildPayloadAndAwait(Options: { BakeTextNodes: boolean; ExportScale: number; LayerNameDetection: boolean; ResponsiveScale: boolean }): Promise<{ Tree: UiNode; Bakes: BakeBlob[]; NodeCount: number; ImageCount: number; ReferenceFrameSize: { X: number; Y: number } }> {
  return new Promise((Resolve, Reject) => {
    const OffOk = on<PayloadBuiltHandler>("PAYLOAD_BUILT", (Result) => {
      OffOk();
      OffErr();
      Resolve(Result);
    });
    const OffErr = on<PayloadErrorHandler>("PAYLOAD_ERROR", (Message) => {
      OffOk();
      OffErr();
      Reject(new Error(Message));
    });
    emit<BuildPayloadHandler>("BUILD_PAYLOAD", Options);
  });
}

function FormatTimestamp(): string {
  const Now = new Date();
  const HH = Now.getHours().toString().padStart(2, "0");
  const MM = Now.getMinutes().toString().padStart(2, "0");
  const SS = Now.getSeconds().toString().padStart(2, "0");
  return `${HH}:${MM}:${SS}`;
}

function Plugin() {
  const [Mode, SetMode] = useState<Mode>("Loading");
  const [Bundle, SetBundle] = useState<AuthBundle | null>(null);
  const [SelectionCount, SetSelectionCount] = useState<number>(0);
  const [SelectionFirstName, SetSelectionFirstName] = useState<string | null>(null);
  const [LastSync, SetLastSync] = useState<LastSync | null>(null);
  const [BannerMessage, SetBannerMessage] = useState<string | null>(null);
  const [ClientCache, SetClientCache] = useState<Record<string, AssetEntry>>({});
  const [BakeProgress, SetBakeProgress] = useState<Progress>(ZeroProgress);
  const [UploadProgress, SetUploadProgress] = useState<Progress>(ZeroProgress);
  const [RetryStatus, SetRetryStatus] = useState<RetryStatus | null>(null);
  const [Settings, SetSettings] = useState<Settings>(() => ({ ...DefaultSettings }));
  const [GuideCollapsed, SetGuideCollapsed] = useState<boolean>(true);
  const CancelPickupRef = useRef<boolean>(false);

  useEffect(() => {
    const Off = on<AuthLoadedHandler>("AUTH_LOADED", (Loaded) => {
      if (Loaded) {
        SetBundle(Loaded);
        SetMode("SignedIn");
      } else {
        SetMode("SignedOut");
      }
    });
    emit<LoadAuthHandler>("LOAD_AUTH");
    return Off;
  }, []);

  useEffect(() => {
    const Off = on<CacheLoadedHandler>("CACHE_LOADED", (Cache) => SetClientCache(Cache));
    emit<LoadCacheHandler>("LOAD_CACHE");
    return Off;
  }, []);

  useEffect(() => {
    const Off = on<SettingsLoadedHandler>("SETTINGS_LOADED", (S) => SetSettings(S));
    emit<LoadSettingsHandler>("LOAD_SETTINGS");
    return Off;
  }, []);

  useEffect(() => {
    return on<SelectionChangedHandler>("SELECTION_CHANGED", (Info) => {
      SetSelectionCount(Info.Count);
      SetSelectionFirstName(Info.FirstName);
    });
  }, []);

  useEffect(() => {
    return on<BakeProgressHandler>("BAKE_PROGRESS", (P) => SetBakeProgress(P));
  }, []);

  const HandleSignIn = useCallback(async () => {
    SetBannerMessage(null);
    CancelPickupRef.current = false;
    try {
      const Request = BeginSignIn();
      emit<OpenExternalHandler>("OPEN_EXTERNAL", Request.Url);
      SetMode("AwaitingPickup");
      const Code = await WaitForCode(Request.State, { ShouldCancel: () => CancelPickupRef.current });
      const Tokens = await ExchangeCode(Code, Request.Verifier);
      const UserInfo = await FetchUserInfo(Tokens.access_token);
      await EnsureCreatorGrant(Tokens.access_token, UserInfo.sub);
      const NewBundle = BundleFromTokens(Tokens, UserInfo);
      await StoreAuthAndAwait(NewBundle);
      SetBundle(NewBundle);
      SetMode("SignedIn");
      emit<NotifyHandler>("NOTIFY", `Signed in as ${NewBundle.UserName}`);
    } catch (Err) {
      const Message = (Err as Error).message ?? String(Err);
      if (Message === "cancelled") {
        SetMode("SignedOut");
        return;
      }
      SetBannerMessage(Message);
      SetMode("SignedOut");
    }
  }, []);

  const HandleCancelPickup = useCallback(() => {
    CancelPickupRef.current = true;
    SetMode("SignedOut");
  }, []);

  const HandleSignOut = useCallback(async () => {
    await ClearAuthAndAwait();
    SetBundle(null);
    SetLastSync(null);
    SetBannerMessage(null);
    SetMode("SignedOut");
  }, []);

  const PersistSettings = useCallback(async (NewSettings: Settings) => {
    SetSettings(NewSettings);
    try {
      await StoreSettingsAndAwait(NewSettings);
    } catch {}
  }, []);

  const HandleToggleBakeText = useCallback(async (Event: { currentTarget: { checked: boolean } }) => {
    const Value = Event.currentTarget.checked;
    const NewSettings: Settings = { ...Settings, BakeTextNodes: Value };
    await PersistSettings(NewSettings);
  }, [PersistSettings, Settings]);

  const HandleChangeExportScale = useCallback(async (Value: null | number) => {
    if (Value === null || !Number.isFinite(Value) || Value <= 0) return;
    const NewSettings: Settings = { ...Settings, ExportScale: Value };
    await PersistSettings(NewSettings);
  }, [PersistSettings, Settings]);

  const HandleToggleLayerNameDetection = useCallback(async (Event: { currentTarget: { checked: boolean } }) => {
    const Value = Event.currentTarget.checked;
    const NewSettings: Settings = { ...Settings, LayerNameDetection: Value };
    await PersistSettings(NewSettings);
  }, [PersistSettings, Settings]);

  const HandleToggleResponsiveScale = useCallback(async (Event: { currentTarget: { checked: boolean } }) => {
    const Value = Event.currentTarget.checked;
    const NewSettings: Settings = { ...Settings, ResponsiveScale: Value };
    await PersistSettings(NewSettings);
  }, [PersistSettings, Settings]);

  const HandleToggleGuide = useCallback(() => {
    SetGuideCollapsed((Collapsed) => !Collapsed);
  }, []);

  const HandleSync = useCallback(async () => {
    if (!Bundle) return;
    SetBannerMessage(null);
    SetBakeProgress(ZeroProgress);
    SetUploadProgress(ZeroProgress);
    SetRetryStatus(null);
    SetMode("Syncing");
    try {
      const Responsive = Settings.ResponsiveScale ?? DefaultSettings.ResponsiveScale ?? true;
      const LayerNameDetection = Settings.LayerNameDetection ?? DefaultSettings.LayerNameDetection ?? true;
      const Built = await BuildPayloadAndAwait({
        BakeTextNodes: Settings.BakeTextNodes ?? DefaultSettings.BakeTextNodes ?? true,
        ExportScale: Settings.ExportScale ?? DefaultSettings.ExportScale ?? 2,
        LayerNameDetection,
        ResponsiveScale: Responsive,
      });
      const Result = await PushPayload({
        Bundle,
        Tree: Built.Tree,
        Bakes: Built.Bakes,
        ClientCache,
        OnUploadProgress: (Done, Total) => SetUploadProgress({ Done, Total }),
        OnUploadRetry: (Name, WaitSeconds, Reason) => SetRetryStatus({ Name, WaitSeconds, Reason }),
        OnBundleRefreshed: async (Refreshed) => {
          await StoreAuthAndAwait(Refreshed);
          SetBundle(Refreshed);
        },
        PluginSettings: Responsive
          ? { AddUIAspectRatioConstraint: true, ReferenceFrameSize: Built.ReferenceFrameSize, AutoDetectButtons: LayerNameDetection }
          : { AutoDetectButtons: LayerNameDetection },
      });
      SetRetryStatus(null);
      if (Result.Bundle !== Bundle) {
        SetBundle(Result.Bundle);
      }
      if (Result.UpdatedCache !== ClientCache) {
        SetClientCache(Result.UpdatedCache);
        await StoreCacheAndAwait(Result.UpdatedCache);
      }
      const SkippedImageCount = Result.SkippedAssets.length;
      SetLastSync({
        Timestamp: FormatTimestamp(),
        NodeCount: Built.NodeCount,
        ImageCount: Built.ImageCount,
        Sequence: Result.Sequence,
        UploadCount: Result.UploadCount,
        CacheHitCount: Result.CacheHitCount,
        SkippedImageCount,
      });
      if (SkippedImageCount > 0) {
        SetBannerMessage(FormatSkippedAssetsWarning(Result.SkippedAssets));
        emit<NotifyHandler>("NOTIFY", `Synced ${Built.NodeCount} nodes with ${SkippedImageCount} image placeholders`);
      } else {
        SetBannerMessage(null);
        emit<NotifyHandler>("NOTIFY", `Synced ${Built.NodeCount} nodes`);
      }
      SetMode("SignedIn");
    } catch (Err) {
      SetRetryStatus(null);
      if (Err instanceof RefreshTokenExpiredError) {
        await ClearAuthAndAwait();
        SetBundle(null);
        SetLastSync(null);
        SetMode("SignedOut");
        SetBannerMessage("Your sign-in expired. Please sign in again.");
        return;
      }
      if (Err instanceof AssetUploadBatchError) {
        if (Err.UpdatedCache !== ClientCache) {
          SetClientCache(Err.UpdatedCache);
          try {
            await StoreCacheAndAwait(Err.UpdatedCache);
          } catch {}
        }
        SetBannerMessage(Err.message);
        SetMode("SignedIn");
        emit<NotifyHandler>("NOTIFY", "Sync stopped: image uploads failed after retries");
        return;
      }
      const Message = (Err as Error).message ?? String(Err);
      SetBannerMessage(Message);
      SetMode("SignedIn");
    }
  }, [Bundle, ClientCache, Settings]);

  return (
    <Container space="medium">
      <VerticalSpace space="medium" />
      <Text>
        <Bold>Figma → Roblox</Bold>
      </Text>
      <VerticalSpace space="extraSmall" />
      <Text>
        <Muted>Sync selected frames into Roblox Studio.</Muted>
      </Text>

      <VerticalSpace space="large" />
      <Divider />
      <VerticalSpace space="medium" />

      <StatusBlock Mode={Mode} Bundle={Bundle} />

      {Mode === "Syncing" ? (
        <Fragment>
          <VerticalSpace space="extraSmall" />
          <ProgressBar Bake={BakeProgress} Upload={UploadProgress} />
          {RetryStatus ? (
            <Fragment>
              <VerticalSpace space="extraSmall" />
              <Text>
                <Muted>
                  Retrying {RetryStatus.Name} after {RetryStatus.Reason} in {RetryStatus.WaitSeconds}s...
                </Muted>
              </Text>
            </Fragment>
          ) : null}
        </Fragment>
      ) : null}

      {BannerMessage ? (
        <Fragment>
          <VerticalSpace space="medium" />
          <Banner icon={<IconWarning16 />} variant="warning">
            {BannerMessage}
          </Banner>
        </Fragment>
      ) : null}

      <VerticalSpace space="medium" />
      <Divider />
      <VerticalSpace space="medium" />

      {Mode === "SignedOut" || Mode === "Loading" ? (
        <Stack space="small">
          <Button fullWidth onClick={HandleSignIn} disabled={Mode === "Loading"}>
            Sign in with Roblox
          </Button>
          <Text>
            <Muted>
              You'll be sent to roblox.com to authorize. Tokens stay on this device.
            </Muted>
          </Text>
        </Stack>
      ) : null}

      {Mode === "AwaitingPickup" ? (
        <Stack space="small">
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <LoadingIndicator />
            <Text>Waiting for browser sign-in…</Text>
          </div>
          <Text>
            <Muted>Authorize in the browser tab that just opened. Then come back here.</Muted>
          </Text>
          <Button secondary fullWidth onClick={HandleCancelPickup}>
            Cancel
          </Button>
        </Stack>
      ) : null}

      {(Mode === "SignedIn" || Mode === "Syncing") && Bundle ? (
        <SignedInBlock
          Bundle={Bundle}
          SelectionCount={SelectionCount}
          SelectionFirstName={SelectionFirstName}
          LastSync={LastSync}
          IsSyncing={Mode === "Syncing"}
          BakeTextNodes={Settings.BakeTextNodes ?? DefaultSettings.BakeTextNodes ?? true}
          ExportScale={Settings.ExportScale ?? DefaultSettings.ExportScale ?? 2}
          LayerNameDetection={Settings.LayerNameDetection ?? DefaultSettings.LayerNameDetection ?? true}
          ResponsiveScale={Settings.ResponsiveScale ?? DefaultSettings.ResponsiveScale ?? true}
          GuideCollapsed={GuideCollapsed}
          OnToggleBakeText={HandleToggleBakeText}
          OnChangeExportScale={HandleChangeExportScale}
          OnToggleLayerNameDetection={HandleToggleLayerNameDetection}
          OnToggleResponsiveScale={HandleToggleResponsiveScale}
          OnToggleGuide={HandleToggleGuide}
          OnSync={HandleSync}
          OnSignOut={HandleSignOut}
        />
      ) : null}

      <VerticalSpace space="large" />
      <Divider />
      <VerticalSpace space="small" />
      <Text align="center">
        <Muted>v1 · acedian.com/figmatoroblox</Muted>
      </Text>
      <VerticalSpace space="medium" />
    </Container>
  );
}

function ProgressBar({ Bake, Upload }: { Bake: Progress; Upload: Progress }) {
  const Baking = Bake.Total > 0 && Bake.Done < Bake.Total;
  const Active = Baking ? Bake : Upload;
  const Pct = Active.Total > 0 ? Math.round((Active.Done / Active.Total) * 100) : 0;
  const PhaseLabel = Baking ? "Baking" : Upload.Total > 0 ? "Uploading" : "Working";
  return (
    <Stack space="extraSmall">
      <div style={{ height: 4, background: "var(--figma-color-bg-tertiary)", borderRadius: 2, overflow: "hidden" }}>
        <div style={{ width: `${Pct}%`, height: "100%", background: "var(--figma-color-icon-brand)", transition: "width 150ms" }} />
      </div>
      <Text>
        <Muted>
          {PhaseLabel} · Bake {Bake.Done}/{Bake.Total} · Upload {Upload.Done}/{Upload.Total}
        </Muted>
      </Text>
    </Stack>
  );
}

function StatusBlock({ Mode, Bundle }: { Mode: Mode; Bundle: AuthBundle | null }) {
  const Variant: "success" | "warning" = Mode === "SignedIn" || Mode === "Syncing" ? "success" : "warning";
  const Icon = Variant === "success" ? <IconCheck16 /> : <IconWarning16 />;
  const Body =
    Mode === "Loading" ? "Loading…" :
    Mode === "SignedOut" ? "Not signed in to Roblox." :
    Mode === "AwaitingPickup" ? "Awaiting browser authorization." :
    Mode === "Syncing" ? "Baking and uploading…" :
    Bundle ? `Connected as ${Bundle.UserName}.` : "Connected.";
  return (
    <Banner icon={Icon} variant={Variant}>
      {Body}
    </Banner>
  );
}

type SignedInBlockProps = {
  Bundle: AuthBundle;
  SelectionCount: number;
  SelectionFirstName: string | null;
  LastSync: LastSync | null;
  IsSyncing: boolean;
  BakeTextNodes: boolean;
  ExportScale: number;
  LayerNameDetection: boolean;
  ResponsiveScale: boolean;
  GuideCollapsed: boolean;
  OnToggleBakeText: (Event: { currentTarget: { checked: boolean } }) => void;
  OnChangeExportScale: (Value: null | number) => void;
  OnToggleLayerNameDetection: (Event: { currentTarget: { checked: boolean } }) => void;
  OnToggleResponsiveScale: (Event: { currentTarget: { checked: boolean } }) => void;
  OnToggleGuide: () => void;
  OnSync: () => void;
  OnSignOut: () => void;
};

const GuideItems = [
  {
    Title: "Buttons",
    Body: "Add a Figma prototype interaction, or turn on layer name detection and include Button, Btn, or CTA in the layer name.",
  },
  {
    Title: "ScrollingFrame",
    Body: "Turn on layer name detection, then use a frame with Clip content on and Scroll in the layer name.",
  },
  {
    Title: "Auto layout",
    Body: "Figma auto layout maps into Roblox layout objects. Padding, spacing, fill, and fixed sizes matter.",
  },
  {
    Title: "Text",
    Body: "Keep Bake text as images on for pixel-perfect text, or turn it off for editable Roblox text.",
  },
] as const;

const GuideTextStyle = {
  fontSize: "11px",
  lineHeight: "16px",
} as const;

const ExportScalePresets = [0.5, 0.75, 1, 1.5, 2, 3, 4] as const;

function FormatExportScaleInput(Scale: number): string {
  const Value = Number.isFinite(Scale) && Scale > 0 ? Scale : DefaultSettings.ExportScale ?? 2;
  return String(Value);
}

function FormatExportScaleLabel(Scale: number): string {
  return `${FormatExportScaleInput(Scale)}x`;
}

function NormalizeExportScale(Value: null | number): null | number {
  return Value !== null && Number.isFinite(Value) && Value > 0 ? Value : null;
}

function IsSameExportScale(Left: number, Right: number): boolean {
  return Math.abs(Left - Right) < 0.001;
}

function FormatLastSync(Sync: LastSync): string {
  const Parts = [
    `${Sync.NodeCount} nodes`,
    `${Sync.ImageCount} baked`,
    `${Sync.UploadCount} uploaded (${Sync.CacheHitCount} cached)`,
  ];
  if (Sync.SkippedImageCount > 0) {
    Parts.push(`${Sync.SkippedImageCount} placeholders`);
  }
  Parts.push(Sync.Timestamp);
  return Parts.join(" · ");
}

function GuideSection({ Collapsed, OnToggleGuide }: { Collapsed: boolean; OnToggleGuide: () => void }) {
  return (
    <Stack space="extraSmall">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
        <Text>
          <Bold>Sync guide</Bold>
        </Text>
        <Button secondary onClick={OnToggleGuide}>
          {Collapsed ? "Show" : "Hide"}
        </Button>
      </div>
      {Collapsed ? (
        <Text>
          <Muted>Buttons, scroll frames, auto layout, and text export rules.</Muted>
        </Text>
      ) : (
        <div style={{ paddingTop: "6px", paddingBottom: "4px" }}>
          {GuideItems.map((Item, Index) => (
            <div key={Item.Title} style={{ paddingBottom: Index === GuideItems.length - 1 ? 0 : "14px" }}>
              <div style={{ ...GuideTextStyle, color: "var(--figma-color-text)", fontWeight: 600 }}>
                {Item.Title}
              </div>
              <div style={{ ...GuideTextStyle, color: "var(--figma-color-text-secondary)", paddingTop: "3px" }}>
                {Item.Body}
              </div>
            </div>
          ))}
        </div>
      )}
    </Stack>
  );
}

function SignedInBlock(Props: SignedInBlockProps) {
  const { SelectionCount, SelectionFirstName, LastSync, IsSyncing, BakeTextNodes, ExportScale, LayerNameDetection, ResponsiveScale, GuideCollapsed, OnToggleBakeText, OnChangeExportScale, OnToggleLayerNameDetection, OnToggleResponsiveScale, OnToggleGuide, OnSync, OnSignOut } = Props;
  const ExportScaleControlRef = useRef<HTMLDivElement>(null);
  const ExportScaleValueMeasureRef = useRef<HTMLSpanElement>(null);
  const [ExportScaleInput, SetExportScaleInput] = useState<string>(() => FormatExportScaleInput(ExportScale));
  const [ExportScaleFocused, SetExportScaleFocused] = useState<boolean>(false);
  const [ExportScaleMenuOpen, SetExportScaleMenuOpen] = useState<boolean>(false);
  const [ExportScaleMenuButtonHovered, SetExportScaleMenuButtonHovered] = useState<boolean>(false);
  const [HoveredExportScalePreset, SetHoveredExportScalePreset] = useState<number | null>(null);
  const [ExportScaleSuffixLeft, SetExportScaleSuffixLeft] = useState<number>(16);
  const SyncDisabled = SelectionCount === 0 || IsSyncing;
  const SelectionLine =
    SelectionCount === 0 ? "Select frames in Figma to sync."
      : SelectionCount === 1 ? `1 layer selected · ${SelectionFirstName ?? ""}`
      : `${SelectionCount} layers selected`;

  useEffect(() => {
    if (!ExportScaleFocused) {
      SetExportScaleInput(FormatExportScaleInput(ExportScale));
    }
  }, [ExportScale, ExportScaleFocused]);

  useEffect(() => {
    const Width = ExportScaleValueMeasureRef.current?.offsetWidth ?? 0;
    SetExportScaleSuffixLeft(8 + Math.ceil(Width) + 3);
  }, [ExportScaleInput]);

  useEffect(() => {
    if (!ExportScaleMenuOpen) return;
    function HandleDocumentMouseDown(Event: MouseEvent) {
      const Root = ExportScaleControlRef.current;
      if (Root !== null && Event.target instanceof Node && Root.contains(Event.target)) return;
      SetExportScaleMenuOpen(false);
      SetHoveredExportScalePreset(null);
    }
    function HandleDocumentKeyDown(Event: KeyboardEvent) {
      if (Event.key === "Escape") {
        SetExportScaleMenuOpen(false);
        SetHoveredExportScalePreset(null);
      }
    }
    document.addEventListener("mousedown", HandleDocumentMouseDown);
    document.addEventListener("keydown", HandleDocumentKeyDown);
    return () => {
      document.removeEventListener("mousedown", HandleDocumentMouseDown);
      document.removeEventListener("keydown", HandleDocumentKeyDown);
    };
  }, [ExportScaleMenuOpen]);

  const HandleExportScaleFocus = useCallback(() => {
    SetExportScaleFocused(true);
  }, []);

  const HandleExportScaleBlur = useCallback(() => {
    SetExportScaleFocused(false);
  }, []);

  const HandleExportScaleValueInput = useCallback((Value: string) => {
    SetExportScaleInput(Value);
  }, []);

  const HandleExportScaleNumericInput = useCallback((Value: null | number) => {
    const Normalized = NormalizeExportScale(Value);
    if (Normalized !== null) {
      OnChangeExportScale(Normalized);
    }
  }, [OnChangeExportScale]);

  const ValidateExportScaleInput = useCallback((Value: null | number) => {
    return NormalizeExportScale(Value) ?? ExportScale;
  }, [ExportScale]);

  const HandleToggleExportScaleMenu = useCallback(() => {
    if (!IsSyncing) {
      SetExportScaleMenuOpen((Open) => !Open);
    }
  }, [IsSyncing]);

  const HandleSelectExportScalePreset = useCallback((Scale: number) => {
    OnChangeExportScale(Scale);
    SetExportScaleInput(FormatExportScaleInput(Scale));
    SetExportScaleMenuOpen(false);
    SetHoveredExportScalePreset(null);
  }, [OnChangeExportScale]);

  return (
    <Stack space="medium">
      <Stack space="extraSmall">
        <Text>
          <Bold>Selection</Bold>
        </Text>
        <Text>
          <Muted>{SelectionLine}</Muted>
        </Text>
      </Stack>

      <GuideSection Collapsed={GuideCollapsed} OnToggleGuide={OnToggleGuide} />

      <Stack space="extraSmall">
        <Checkbox value={BakeTextNodes} onChange={OnToggleBakeText} disabled={IsSyncing}>
          <Text>Bake text as images</Text>
        </Checkbox>
        <Text>
          <Muted>Pixel-perfect fonts. Uncheck for editable text.</Muted>
        </Text>
      </Stack>

      <Stack space="extraSmall">
        <Checkbox value={LayerNameDetection} onChange={OnToggleLayerNameDetection} disabled={IsSyncing}>
          <Text>Layer name detection</Text>
        </Checkbox>
        <Text>
          <Muted>Converts Button, Btn, CTA, and Scroll layer names into Roblox controls.</Muted>
        </Text>
      </Stack>

      <Stack space="extraSmall">
        <Checkbox value={ResponsiveScale} onChange={OnToggleResponsiveScale} disabled={IsSyncing}>
          <Text>Responsive scaling</Text>
        </Checkbox>
        <Text>
          <Muted>Scales proportionally to viewport, locks aspect ratio. Uncheck for fixed-pixel layout.</Muted>
        </Text>
      </Stack>

      <Stack space="extraSmall">
        <Text>
          <Bold>Export quality</Bold>
        </Text>
        <div ref={ExportScaleControlRef} style={{ position: "relative", width: "88px" }}>
          <span ref={ExportScaleValueMeasureRef} style={{ position: "absolute", visibility: "hidden", whiteSpace: "pre", fontSize: "11px", lineHeight: "24px", fontVariantNumeric: "tabular-nums", pointerEvents: "none" }}>
            {ExportScaleInput}
          </span>
          <TextboxNumeric
            disabled={IsSyncing}
            incrementBig={1}
            incrementSmall={0.25}
            minimum={0}
            onBlur={HandleExportScaleBlur}
            onFocus={HandleExportScaleFocus}
            onNumericValueInput={HandleExportScaleNumericInput}
            onValueInput={HandleExportScaleValueInput}
            revertOnEscapeKeyDown
            style={{ paddingRight: "42px", fontVariantNumeric: "tabular-nums" }}
            validateOnBlur={ValidateExportScaleInput}
            value={ExportScaleInput}
          />
          <div style={{ position: "absolute", zIndex: 3, top: 0, left: `${ExportScaleSuffixLeft}px`, bottom: 0, display: "flex", alignItems: "center", color: "var(--figma-color-text-secondary)", pointerEvents: "none" }}>
            x
          </div>
          <button
            aria-label="Export quality presets"
            disabled={IsSyncing}
            onClick={HandleToggleExportScaleMenu}
            onMouseEnter={() => SetExportScaleMenuButtonHovered(true)}
            onMouseLeave={() => SetExportScaleMenuButtonHovered(false)}
            style={{ position: "absolute", zIndex: 4, top: 0, right: 0, bottom: 0, width: "24px", display: "flex", alignItems: "center", justifyContent: "center", borderLeft: "1px solid var(--figma-color-border)", borderTopRightRadius: "4px", borderBottomRightRadius: "4px", backgroundColor: !ExportScaleMenuOpen && ExportScaleMenuButtonHovered ? "rgba(255, 255, 255, 0.08)" : "transparent", color: "var(--figma-color-icon-secondary)", cursor: IsSyncing ? "not-allowed" : "default" }}
            type="button"
          >
            <IconChevronDown16 />
          </button>
          {ExportScaleMenuOpen ? (
            <div onMouseLeave={() => SetHoveredExportScalePreset(null)} style={{ position: "absolute", zIndex: 10, top: "28px", right: 0, minWidth: "80px", padding: "8px", borderRadius: "12px", backgroundColor: "var(--color-bg-menu)", boxShadow: "0 5px 17px rgba(0, 0, 0, 0.2), 0 2px 7px rgba(0, 0, 0, 0.15)", color: "var(--figma-color-text-onbrand)", fontSize: "12px" }}>
              {ExportScalePresets.map((Preset) => {
                const Highlighted = HoveredExportScalePreset !== null && IsSameExportScale(HoveredExportScalePreset, Preset);
                return (
                  <button
                    key={Preset}
                    onMouseEnter={() => SetHoveredExportScalePreset(Preset)}
                    onClick={() => HandleSelectExportScalePreset(Preset)}
                    style={{ display: "block", width: "100%", height: "24px", padding: "4px 10px", borderRadius: "4px", backgroundColor: Highlighted ? "var(--figma-color-bg-brand)" : "transparent", color: "var(--figma-color-text-onbrand)", textAlign: "right" }}
                    type="button"
                  >
                    {FormatExportScaleLabel(Preset)}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
        <Text>
          <Muted>Higher = sharper PNGs and larger uploads.</Muted>
        </Text>
      </Stack>

      <Button fullWidth disabled={SyncDisabled} loading={IsSyncing} onClick={OnSync}>
        {IsSyncing ? "Syncing…" : "Sync to Roblox"}
      </Button>

      {LastSync ? (
        <Stack space="extraSmall">
          <Text>
            <Bold>Last sync</Bold>
          </Text>
          <Text>
            <Muted>
              {FormatLastSync(LastSync)}
            </Muted>
          </Text>
        </Stack>
      ) : null}

      <Divider />

      <Stack space="extraSmall">
        <Text>
          <Bold>Account</Bold>
        </Text>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
          <Text>
            <Muted>{Props.Bundle.UserName}</Muted>
          </Text>
          <Button secondary onClick={OnSignOut}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
              <IconRefresh16 /> Sign out
            </span>
          </Button>
        </div>
      </Stack>
    </Stack>
  );
}

export default render(Plugin);
