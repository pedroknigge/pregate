#!/usr/bin/env bash
# GitHub Action installer. Download one release archive and refuse to extract it unless
# its SHA-256 matches SHA256SUMS and, by default (PREGATE_REQUIRE_SIGNATURE=1, which
# action.yml sets from require-signature), its Sigstore bundle verifies with cosign. When
# gh has a token and can see a GitHub artifact attestation for the downloaded bytes, verify
# it. A mismatch of any check that runs is fatal.
set -euo pipefail

repo=pedroknigge/pregate
version=${PREGATE_VERSION:-}
[ -n "$version" ] || { echo "action-install: PREGATE_VERSION is required" >&2; exit 1; }
version=${version#v}
printf '%s\n' "$version" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.]+)?$' || {
  echo "action-install: invalid version '$version'" >&2
  exit 1
}

os=$(uname -s)
arch=$(uname -m)
case "$os-$arch" in
  Darwin-arm64) target=darwin-arm64 ;;
  Darwin-x86_64) target=darwin-x64 ;;
  Linux-x86_64) target=linux-x64 ;;
  Linux-aarch64 | Linux-arm64) target=linux-arm64 ;;
  *) echo "action-install: unsupported runner $os-$arch" >&2; exit 1 ;;
esac

asset="pregate-${version}-${target}.tar.gz"
base="${PREGATE_RELEASE_BASE:-https://github.com/${repo}/releases/download/v${version}}"
dir=$(mktemp -d)
trap 'rm -rf "$dir"' EXIT

fail() {
  echo "action-install: $1" >&2
  exit 1
}

curl_args=(-sS -L --max-time 120)
case "$base" in
  https://*) curl_args+=(--proto '=https' --proto-redir '=https') ;;
esac

# Print 200 or 404. Any other HTTP status, or an empty body, fails the installer.
fetch() {
  url=$1
  dest=$2
  code=$(curl "${curl_args[@]}" -w '%{http_code}' -o "$dest" "$url" || true)
  case "$code" in
    200)
      [ -s "$dest" ] || { echo "action-install: empty download: $url" >&2; return 1; }
      ;;
    404) rm -f "$dest" ;;
    *)
      rm -f "$dest"
      echo "action-install: download failed (HTTP ${code:-none}): $url" >&2
      return 1
      ;;
  esac
  printf '%s' "$code"
}

digest() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | awk '{print $1}'
  elif command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$1" | awk '{print $1}'
  else
    echo "action-install: sha256sum or shasum is required to verify the download" >&2
    return 1
  fi
}

identity="^https://github.com/${repo}/\\.github/workflows/release\\.yml@refs/tags/v"

verify_bundle() {
  file=$1
  bundle=$2
  label=$3
  if [ -n "${PREGATE_COSIGN_KEY:-}" ]; then
    cosign verify-blob --key "$PREGATE_COSIGN_KEY" --bundle "$bundle" "$file" ||
      fail "cosign signature mismatch for $label; nothing installed"
  else
    cosign verify-blob --bundle "$bundle" \
      --certificate-identity-regexp "$identity" \
      --certificate-oidc-issuer "https://token.actions.githubusercontent.com" \
      "$file" || fail "cosign signature mismatch for $label; nothing installed"
  fi
}

notice() {
  echo "action-install: $1" >&2
}

# The action sets PREGATE_REQUIRE_SIGNATURE=1 by default (input require-signature), so a
# missing cosign or a missing bundle installs nothing. With require-signature: false, a
# bundle that is present must still verify; a missing one only prints a notice.
require_signature() {
  [ "${PREGATE_REQUIRE_SIGNATURE:-}" = 1 ] || [ -n "${PREGATE_COSIGN_KEY:-}" ]
}

maybe_cosign() {
  label=$1
  file=$2
  bundle_name=$3
  if ! command -v cosign >/dev/null 2>&1; then
    if require_signature; then
      fail "cosign is required to verify $label (set require-signature: false to install on SHA-256 alone); nothing installed"
    fi
    notice "cosign is not installed; the signature of $label was not verified"
    return 0
  fi
  code=$(fetch "$base/$bundle_name" "$dir/$bundle_name") || exit 1
  if [ "$code" = 404 ]; then
    if require_signature; then
      fail "release has no $bundle_name (set require-signature: false to install on SHA-256 alone); nothing installed"
    fi
    notice "release has no $bundle_name; the signature of $label was not verified"
    return 0
  fi
  verify_bundle "$file" "$dir/$bundle_name" "$label"
}

# gh needs a token to query attestations; the action passes github.token as GH_TOKEN. Without
# one, or when gh returns 404 because this digest was never attested, the attestation is "not
# available" and only a notice is printed. Any other failure means an attestation was found
# and rejected.
verify_attestation() {
  file=$1
  label=$2
  command -v gh >/dev/null 2>&1 || return 0
  if [ -z "${GH_TOKEN:-}" ] && [ -z "${GITHUB_TOKEN:-}" ]; then
    notice "GH_TOKEN is not set; the artifact attestation of $label was not verified"
    return 0
  fi
  if err=$(gh attestation verify "$file" --repo "$repo" --signer-workflow "$repo/.github/workflows/release.yml" 2>&1); then
    return 0
  fi
  case "$err" in
    *GH_TOKEN* | *gh\ auth\ login* | *not\ logged\ in* | *authentication\ token*)
      notice "gh has no usable token; the artifact attestation of $label was not verified"
      return 0
      ;;
    *404* | *401* | *403* | *no\ attestation* | *No\ attestation* | *failed\ to\ fetch*)
      notice "no artifact attestation found for $label"
      return 0
      ;;
  esac
  printf '%s\n' "$err" >&2
  fail "artifact attestation mismatch for $label; nothing installed"
}

code=$(fetch "$base/SHA256SUMS" "$dir/SHA256SUMS") || exit 1
[ "$code" = 200 ] || fail "release v$version has no SHA256SUMS; nothing installed"
maybe_cosign SHA256SUMS "$dir/SHA256SUMS" SHA256SUMS.bundle

code=$(fetch "$base/$asset" "$dir/$asset") || exit 1
[ "$code" = 200 ] || fail "release v$version has no $asset; nothing installed"

count=$(awk -v n="$asset" '$2 == n { c++ } END { print c+0 }' "$dir/SHA256SUMS")
[ "$count" -eq 1 ] || fail "SHA256SUMS has no unique SHA-256 for $asset; nothing installed"
listed=$(awk -v n="$asset" '$2 == n { print $1 }' "$dir/SHA256SUMS")
case "$listed" in
  *[!0-9a-f]* | '') fail "SHA256SUMS has no unique SHA-256 for $asset; nothing installed" ;;
esac
[ "${#listed}" -eq 64 ] || fail "SHA256SUMS has no unique SHA-256 for $asset; nothing installed"
actual=$(digest "$dir/$asset") || exit 1
[ "$actual" = "$listed" ] || fail "SHA-256 mismatch for $asset: expected $listed, got $actual; nothing installed"

maybe_cosign "$asset" "$dir/$asset" "$asset.bundle"
verify_attestation "$dir/$asset" "$asset"
verify_attestation "$dir/SHA256SUMS" SHA256SUMS

mkdir -p "$dir/x"
tar -xzf "$dir/$asset" -C "$dir/x"
[ -f "$dir/x/pregate" ] && [ -x "$dir/x/pregate" ] || fail "the archive has no executable pregate; nothing installed"
mkdir -p "$HOME/.local/bin"
install -m 0755 "$dir/x/pregate" "$HOME/.local/bin/pregate"
if [ -n "${GITHUB_PATH:-}" ]; then
  echo "$HOME/.local/bin" >> "$GITHUB_PATH"
fi
