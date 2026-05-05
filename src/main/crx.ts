import { app } from "electron";
import * as path from "path";
import * as fs from "fs";
import * as https from "https";
import AdmZip from "adm-zip";

const EXTENSIONS_DIR = path.join(app.getPath("userData"), "extensions");
const CHROME_VERSION = "131.0.0.0";

/**
 * Ensures the extensions directory exists
 */
export function getExtensionsDir(): string {
  if (!fs.existsSync(EXTENSIONS_DIR)) {
    fs.mkdirSync(EXTENSIONS_DIR, { recursive: true });
  }
  return EXTENSIONS_DIR;
}

/**
 * Downloads a CRX file from the Chrome Web Store by extension ID
 */
export async function downloadCrx(extensionId: string): Promise<Buffer> {
  const url = `https://clients2.google.com/service/update2/crx?response=redirect&acceptformat=crx2,crx3&prodversion=${CHROME_VERSION}&x=id%3D${extensionId}%26installsource%3Dondemand%26uc`;

  return new Promise((resolve, reject) => {
    const follow = (targetUrl: string, redirects = 0): void => {
      if (redirects > 5) {
        reject(new Error("Too many redirects"));
        return;
      }

      const protocol = targetUrl.startsWith("http://")
        ? require("http")
        : https;

      protocol
        .get(targetUrl, (res) => {
          if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400) {
            const location = res.headers.location;
            if (location) {
              follow(location, redirects + 1);
              return;
            }
          }

          if (res.statusCode !== 200) {
            reject(new Error(`Failed to download CRX: HTTP ${res.statusCode}`));
            return;
          }

          const chunks: Buffer[] = [];
          res.on("data", (chunk: Buffer) => chunks.push(chunk));
          res.on("end", () => resolve(Buffer.concat(chunks)));
          res.on("error", reject);
        })
        .on("error", reject);
    };

    follow(url);
  });
}

/**
 * Extracts the ZIP payload from a CRX buffer.
 * CRX3: magic(4) + version(4) + header_length(4) + header + zip
 * CRX2: magic(4) + version(4) + pub_key_len(4) + sig_len(4) + pub_key + sig + zip
 */
export function getZipFromCrx(crxBuffer: Buffer): Buffer {
  const magic = crxBuffer.toString("ascii", 0, 4);
  if (magic !== "Cr24") {
    throw new Error("Invalid CRX file: bad magic number");
  }

  const version = crxBuffer.readUInt32LE(4);

  if (version === 3) {
    const headerLength = crxBuffer.readUInt32LE(8);
    const zipStart = 12 + headerLength;
    return crxBuffer.subarray(zipStart);
  } else if (version === 2) {
    const pubKeyLength = crxBuffer.readUInt32LE(8);
    const sigLength = crxBuffer.readUInt32LE(12);
    const zipStart = 16 + pubKeyLength + sigLength;
    return crxBuffer.subarray(zipStart);
  } else {
    throw new Error(`Unsupported CRX version: ${version}`);
  }
}

/**
 * Downloads and unpacks an extension from the Chrome Web Store.
 * Returns the path to the unpacked extension directory.
 */
export async function downloadAndUnpackExtension(
  extensionId: string,
): Promise<string> {
  const extensionDir = path.join(getExtensionsDir(), extensionId);

  // Download the CRX
  console.log(`Downloading extension ${extensionId}...`);
  const crxBuffer = await downloadCrx(extensionId);

  // Extract ZIP from CRX
  const zipBuffer = getZipFromCrx(crxBuffer);

  // Ensure target directory exists (clean if exists)
  if (fs.existsSync(extensionDir)) {
    fs.rmSync(extensionDir, { recursive: true });
  }
  fs.mkdirSync(extensionDir, { recursive: true });

  // Extract using adm-zip
  console.log(`Extracting extension to ${extensionDir}...`);
  const zip = new AdmZip(zipBuffer);
  zip.extractAllTo(extensionDir, true);

  console.log(`Extension ${extensionId} installed successfully`);
  return extensionDir;
}

/**
 * Reads the manifest.json from an unpacked extension directory
 */
export function readManifest(extensionDir: string): Record<string, any> | null {
  const manifestPath = path.join(extensionDir, "manifest.json");
  if (!fs.existsSync(manifestPath)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
}
