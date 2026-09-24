/**
 * Every user-facing string of the AthenaEnv Initializer. English for now;
 * translate by replacing this object. Functions take the dynamic parts.
 */
export const strings = {
  meta: {
    title: "AthenaEnv Initializer",
    description:
      "Pick the modules your PlayStation 2 homebrew needs and download a custom AthenaEnv build: fewer modules, smaller binary, more free RAM.",
  },

  header: {
    name: "AthenaEnv",
    product: "Initializer",
    logoAlt: "AthenaEnv logo",
    github: "GitHub",
    githubLabel: "AthenaEnv on GitHub",
    catalogVersion: (version: string) => `Catalog v${version}`,
    generatedAt: (date: string) => `generated ${date}`,
    serverOnline: "build server online",
    mockServer: "simulated build server",
    commit: (short: string) => `commit ${short}`,
    localMode: "local mode",
    themeToLight: "Switch to light theme",
    themeToDark: "Switch to dark theme",
  },

  intro: {
    tagline:
      "Pick only the modules your game uses. Every module you leave out makes the binary smaller and leaves more of the console's 32 MB of RAM for your game.",
  },

  loading: "Loading module catalog…",

  catalogError: {
    unavailableTitle: "The module catalog could not be loaded",
    unavailableBody: "Neither the build server nor the static catalog responded. Check your connection and try again.",
    schemaTitle: "This page needs an update",
    schemaBody: (found: string) =>
      `The module catalog uses schema version ${found}, which this page does not understand. The page must be updated to read it.`,
    retry: "Retry",
    details: "Details",
  },

  offlineBanner: "The build server is offline. Use the commands below to build locally.",
  mockBanner: "Mock mode: builds are simulated and the downloads are placeholders.",

  config: {
    title: "Configuration",
  },

  runtime: {
    legend: "Runtime",
    produces: "Produces",
    options: {
      quickjs: {
        label: "JavaScript (QuickJS)",
        description: "Runs main.js from the device it was started from, with typings for the selected modules.",
      },
      native: {
        label: "Native C",
        description: "No script engine: a static library, headers and a makefile fragment for your C code.",
      },
    },
  },

  presets: {
    legend: "Presets",
    defaults: "Defaults",
    minimal: "Minimal",
    all: "All",
    usbGame: "USB game (JS)",
    hints: {
      defaults: "The modules marked as default",
      minimal: "Only the required modules",
      all: "Every module",
      usbGame: "screen, draw, font, image, gamepad, usbmass and timer",
    },
  },

  summary: {
    count: (included: number, total: number) => `${included} of ${total} modules`,
    selected: "Selected",
    dependencies: "Dependencies",
    required: "Required",
    none: "none",
  },

  warnings: {
    noBootDevice:
      "This build cannot read main.js or athena.ini from a memory card, USB drive or disc. Add at least the storage module of the device you will start it from.",
    noBootDeviceTitle: "No boot device driver",
    noBootDeviceNativeTitle: "No storage driver",
    erlTitle: "Native ERL modules",
    erl: "Native ERL modules export every symbol of the binary: the build gets larger and dead-code removal is disabled. Select it only if you load .erl modules.",
  },

  build: {
    button: "Build",
    rebuild: "Build this selection",
    submitting: "Submitting…",
    localModeTitle: "Build locally",
    localModeBody: "No build server is available. Run the commands in “Build locally” from a clone of AthenaEnv.",
    localModeLink: "Show the commands",
    queued: (position: number) => `Queued — position ${position}`,
    building: "Building… usually one to three minutes",
    elapsed: (time: string) => `Elapsed: ${time}`,
    loadingJob: "Loading build…",
    doneTitle: "Build ready",
    cached: "Served from cache",
    previousSelection: "For a previous selection",
    download: (name: string) => `Download ${name}`,
    modulesBuilt: "Modules in this build",
    modulesDiffer: "The server resolved a different module set than this page shows.",
    commit: "Commit",
    duration: "Build time",
    viewLog: "View build log",
    copyLink: "Copy link to this build",
    copyMakefile: "Copy Makefile lines",
    linkCopied: "Link to this build copied",
    nextStep: "Next step",
    nextQuickjs: "Copy athena.elf and your main.js to the same folder on your memory card or USB drive and launch it.",
    nextTypings: "Add athena.d.ts to your editor for autocompletion of the selected modules.",
    nextNative: "Extract the SDK and include athena.mk from your Makefile",
    failedTitle: "Build failed",
    failedUnknown: "The build failed without an error message.",
    retry: "Retry",
    errorTitle: "The build could not be started",
    errorGeneric: "Could not reach the build server. Your selection is kept; try again.",
    errorStatus: (status: number) => `The build server answered with HTTP ${status}.`,
    loadErrorTitle: "That build could not be loaded",
    offlineJob: "The build server is offline, so this build link cannot be opened.",
    timeoutTitle: "Still not finished",
    timeout: "Stopped waiting after 15 minutes. The build may still finish; check the log.",
    status: {
      queued: "Queued",
      building: "Building",
      done: "Done",
      failed: "Failed",
    },
  },

  grid: {
    title: "Modules",
    searchLabel: "Search modules",
    searchPlaceholder: "Search by name, id or description",
    categoriesLabel: "Filter by category",
    allCategories: "All",
    empty: "No module matches your search.",
    clearFilters: "Clear filters",
  },

  card: {
    required: "Required",
    default: "Default",
    js: "JS",
    jsTitle: "Has a JavaScript API",
    c: "C",
    cTitle: "Has a C API",
    version: (v: string) => `v${v}`,
    dependsOn: "Depends on:",
    iopDrivers: "IOP drivers:",
    includedBy: (ids: string) => `Included by: ${ids}`,
    requiredTooltip: "Every build includes this module.",
    dependencyTooltip: (ids: readonly string[]) =>
      `Needed by ${ids.join(", ")}. Uncheck ${ids.length > 1 ? "them" : "it"} to remove this module.`,
  },

  local: {
    title: "Build locally",
    intro: "Run these from a clone of AthenaEnv with the PS2SDK installed:",
    copy: "Copy commands",
    copied: "Commands copied",
    docs: "Building AthenaEnv (docs/BUILDING_ATHENA.md)",
  },

  copy: {
    failed: "Could not copy to the clipboard",
    copied: "Copied",
  },

  duration: {
    seconds: (s: number) => `${s} s`,
    minutes: (m: number, s: number) => `${m} min ${s} s`,
  },
} as const

export type Strings = typeof strings
