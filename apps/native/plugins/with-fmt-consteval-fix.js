const fs = require("node:fs");
const path = require("node:path");

const { withDangerousMod } = require("expo/config-plugins");

const PATCH_MARKER = "FMT_USE_CONSTEVAL";
const PODFILE_RELATIVE_PATH = path.join("ios", "Podfile");

function injectFmtPatch(podfileContents) {
  if (podfileContents.includes(PATCH_MARKER)) {
    return podfileContents;
  }

  const patchBlock = `
    if podfile_properties['ios.buildReactNativeFromSource'] == 'true'
      fmt_base = File.join(installer.sandbox.pod_dir('fmt'), 'include', 'fmt', 'base.h')
      if File.exist?(fmt_base)
        content = File.read(fmt_base)
        patched = content.gsub(/^#\\s+define FMT_USE_CONSTEVAL 1$/, '#  define FMT_USE_CONSTEVAL 0')
        if patched != content
          File.chmod(0644, fmt_base)
          File.write(fmt_base, patched)
        end
      end
    end
`;

  const reactNativePostInstallCall =
    /(\s*react_native_post_install\([\s\S]*?\n\s*\)\n)/m;

  if (!reactNativePostInstallCall.test(podfileContents)) {
    throw new Error("Unable to find react_native_post_install(...) in ios/Podfile");
  }

  return podfileContents.replace(reactNativePostInstallCall, `$1${patchBlock}`);
}

function withFmtConstevalFix(config) {
  return withDangerousMod(config, [
    "ios",
    async (modConfig) => {
      const podfilePath = path.join(modConfig.modRequest.projectRoot, PODFILE_RELATIVE_PATH);

      if (!fs.existsSync(podfilePath)) {
        return modConfig;
      }

      const current = fs.readFileSync(podfilePath, "utf8");
      const next = injectFmtPatch(current);

      if (next !== current) {
        fs.writeFileSync(podfilePath, next);
      }

      return modConfig;
    },
  ]);
}

module.exports = withFmtConstevalFix;
