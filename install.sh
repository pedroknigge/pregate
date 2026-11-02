#!/bin/sh
# Bootstrap PREGATE (MULTI-HARNESS MH-31): download one release archive, verify its SHA-256, extract
# it and hand over to `pregate setup`, which does every write to the machine and is tested in TS.
#
#   sh install.sh [--version vX.Y.Z]
#
# Public releases use anonymous HTTPS; the private pilot falls back to gh and the user's session.
# Offline and in tests, PREGATE_ARCHIVE=<tar.gz> with PREGATE_SHA256=<hex> replaces the download.
# PREGATE_SHA256 alone pins the hash from outside: SHA256SUMS comes from the same release, so it
# protects the transport and not a compromised release (MH-32).
# When cosign is on PATH and the release published a Sigstore bundle, that bundle is verified too.
# A bad signature installs nothing. A missing bundle does not, unless PREGATE_REQUIRE_SIGNATURE=1.
# PREGATE_ARCHIVE checks a signature only when PREGATE_COSIGN_KEY, PREGATE_COSIGN_BUNDLE, or
# PREGATE_MINISIGN_PUB is set (keyed cosign, or minisign when cosign is not the signer).
set -eu

# In lockstep with package.json: scripts/build.ts refuses to build otherwise.
DEFAULT_VERSION=0.0.2
REPO=pedroknigge/pregate

die() {
  printf 'install.sh: %s\n' "$1" >&2
  exit 1
}

public_file() {
  command -v curl >/dev/null 2>&1 || return 1
  if curl -q --fail --silent --show-error --location --proto '=https' --proto-redir '=https' \
    --tlsv1.2 --max-redirs 5 --connect-timeout 10 --max-time 120 --max-filesize "$3" \
    --output "$2" "$1" 2>"$tmp/network-error"; then
    [ -f "$2" ] || die "public download is missing; nothing installed"
    size=$(wc -c <"$2")
    [ "$size" -gt 0 ] && [ "$size" -le "$3" ] || die "public download is empty or exceeds its size limit; nothing installed"
    return 0
  else
    code=$?
    [ "$code" -ne 63 ] || die "public download exceeds its size limit; nothing installed"
    return 1
  fi
}

public_release() {
  public_file "$base/SHA256SUMS" "$tmp/SHA256SUMS" 1048576 || return 1
  listed=$(awk -v n="$name" '$2 == n { print $1 }' "$tmp/SHA256SUMS")
  # A malformed manifest is an integrity error, even if the archive later becomes unavailable.
  case $listed in *[!0-9a-f]* | '') die "SHA256SUMS has no unique valid SHA-256 for $name; nothing installed" ;; esac
  [ ${#listed} -eq 64 ] || die "SHA256SUMS has no unique valid SHA-256 for $name; nothing installed"
  public_file "$base/$name" "$tmp/$name" 268435456
}

# Keyless bundles are signed by .github/workflows/release.yml on a tag. A throwaway test key
# sets PREGATE_COSIGN_KEY and is not checked against that GitHub identity.
verify_cosign_file() {
  file=$1
  bundle=$2
  if [ -n "${PREGATE_COSIGN_KEY:-}" ]; then
    cosign verify-blob --key "$PREGATE_COSIGN_KEY" --bundle "$bundle" "$file" ||
      die "cosign signature mismatch for ${file##*/}; nothing installed"
  else
    cosign verify-blob --bundle "$bundle" \
      --certificate-identity-regexp "^https://github.com/${REPO}/\\.github/workflows/release\\.yml@refs/tags/v" \
      --certificate-oidc-issuer "https://token.actions.githubusercontent.com" \
      "$file" || die "cosign signature mismatch for ${file##*/}; nothing installed"
  fi
}

# One bundle beside the release files. Missing is success for the caller to interpret.
obtain_bundle() {
  bundle=$1
  dest=$tmp/$bundle
  [ -f "$dest" ] && return 0
  if public_file "$base/$bundle" "$dest" 1048576; then
    return 0
  fi
  rm -f "$dest"
  if command -v gh >/dev/null 2>&1; then
    # A release cut before signing has no bundle. That is not an error here; the caller decides.
    if gh release download "v$version" --repo "$REPO" --pattern "$bundle" --dir "$tmp" >/dev/null 2>&1; then
      [ -f "$dest" ] && return 0
    fi
  fi
  rm -f "$dest"
  return 1
}

verify_release_signatures() {
  if ! command -v cosign >/dev/null 2>&1; then
    [ "${PREGATE_REQUIRE_SIGNATURE:-}" = 1 ] && die "cosign is required to verify the release signature; nothing installed"
    return 0
  fi
  for bundle in SHA256SUMS.bundle "$name.bundle"; do
    if ! obtain_bundle "$bundle"; then
      if [ "${PREGATE_REQUIRE_SIGNATURE:-}" = 1 ]; then
        die "release v$version has no $bundle; nothing installed"
      fi
    fi
  done
  # Explicit if: a trailing `[ -f ] && verify` would make the function return 1 when the
  # bundle is absent, and set -e would then abort without a message.
  if [ -f "$tmp/SHA256SUMS.bundle" ]; then
    verify_cosign_file "$tmp/SHA256SUMS" "$tmp/SHA256SUMS.bundle"
  else
    printf 'install.sh: release v%s has no SHA256SUMS.bundle; signature not verified\n' "$version" >&2
  fi
  if [ -f "$tmp/$name.bundle" ]; then
    verify_cosign_file "$archive" "$tmp/$name.bundle"
  else
    printf 'install.sh: release v%s has no %s.bundle; signature not verified\n' "$version" "$name" >&2
  fi
  return 0
}

verify_offline_signatures() {
  if [ -n "${PREGATE_COSIGN_KEY:-}" ] || [ -n "${PREGATE_COSIGN_BUNDLE:-}" ]; then
    command -v cosign >/dev/null 2>&1 || die "cosign is required to verify the archive signature; nothing installed"
    bundle=${PREGATE_COSIGN_BUNDLE:-$archive.bundle}
    [ -f "$bundle" ] || die "cosign bundle missing for $archive; nothing installed"
    verify_cosign_file "$archive" "$bundle"
    return 0
  fi
  if [ -n "${PREGATE_MINISIGN_PUB:-}" ]; then
    command -v minisign >/dev/null 2>&1 || die "minisign is required to verify the archive signature; nothing installed"
    sig=${PREGATE_MINISIGN_SIG:-$archive.minisig}
    [ -f "$sig" ] || die "minisign signature missing for $archive; nothing installed"
    minisign -V -p "$PREGATE_MINISIGN_PUB" -m "$archive" -x "$sig" ||
      die "minisign signature mismatch for $archive; nothing installed"
  fi
}

version=$DEFAULT_VERSION
while [ $# -gt 0 ]; do
  case $1 in
    --version)
      [ $# -ge 2 ] || die "--version needs a value"
      version=${2#v}
      shift 2
      ;;
    *) die "unknown argument '$1'; usage: install.sh [--version vX.Y.Z]" ;;
  esac
done
# A tag, never a branch: main or HEAD would install whatever they point to today. The case rejects a
# newline, which grep would otherwise judge line by line.
case $version in
  *[!0-9A-Za-z.-]* | '') die "invalid version '$version': expected X.Y.Z or X.Y.Z-pre" ;;
esac
printf '%s\n' "$version" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.]+)?$' ||
  die "invalid version '$version': expected X.Y.Z or X.Y.Z-pre"

tmp=$(mktemp -d "${TMPDIR:-/tmp}/pregate-install.XXXXXX")
trap 'rm -rf "$tmp"' EXIT
trap 'exit 1' HUP INT TERM

os=$(uname -s)
if [ -n "${PREGATE_ARCHIVE:-}" ]; then
  [ -n "${PREGATE_SHA256:-}" ] || die "PREGATE_ARCHIVE needs PREGATE_SHA256, the archive's expected SHA-256"
  archive=$PREGATE_ARCHIVE
  expected=$PREGATE_SHA256
else
  case $os-$(uname -m) in
    Darwin-arm64) target=darwin-arm64 ;;
    Darwin-x86_64) target=darwin-x64 ;;
    Linux-x86_64) target=linux-x64 ;;
    Linux-aarch64 | Linux-arm64) target=linux-arm64 ;;
    *) die "no release for $os $(uname -m): there are darwin-arm64, darwin-x64, linux-x64 and linux-arm64" ;;
  esac
  name=pregate-$version-$target.tar.gz
  base=https://github.com/$REPO/releases/download/v$version
  if public_release; then
    :
  else
    # Do not combine a partial public download with an authenticated manifest or archive.
    rm -f "$tmp/$name" "$tmp/SHA256SUMS"
    command -v gh >/dev/null 2>&1 ||
      die "public release unavailable; gh is required for the private pilot $REPO (https://cli.github.com, then gh auth login), or use PREGATE_ARCHIVE with PREGATE_SHA256"
    gh release download "v$version" --repo "$REPO" --pattern "$name" --pattern SHA256SUMS --dir "$tmp" ||
      die "could not download v$version from $REPO: check the network, gh auth status and read access to the repository"
  fi
  [ -f "$tmp/$name" ] && [ -f "$tmp/SHA256SUMS" ] || die "release v$version has no $name or no SHA256SUMS"
  [ "$(wc -c <"$tmp/SHA256SUMS")" -le 1048576 ] && [ "$(wc -c <"$tmp/$name")" -le 268435456 ] || die "release exceeds its size limit; nothing installed"
  archive=$tmp/$name
  listed=$(awk -v n="$name" '$2 == n { print $1 }' "$tmp/SHA256SUMS")
  case $listed in *[!0-9a-f]* | '') die "SHA256SUMS of v$version has no line for $name or no unique valid SHA-256" ;; esac
  [ ${#listed} -eq 64 ] || die "SHA256SUMS of v$version has no unique valid SHA-256 for $name"
  expected=${PREGATE_SHA256:-$listed}
fi

expected=$(printf '%s' "$expected" | tr 'A-F' 'a-f')
case $expected in
  *[!0-9a-f]*) die "the expected SHA-256 is not 64 hex digits: '$expected'" ;;
esac
[ ${#expected} -eq 64 ] || die "the expected SHA-256 is not 64 hex digits: '$expected'"
# From stdin: sha256sum escapes the output line of a file name with a backslash or a newline.
if command -v shasum >/dev/null 2>&1; then
  actual=$(shasum -a 256 <"$archive")
elif command -v sha256sum >/dev/null 2>&1; then
  actual=$(sha256sum <"$archive")
else
  die "shasum or sha256sum is required to verify the download"
fi
actual=${actual%% *}
[ "$actual" = "$expected" ] || die "SHA-256 mismatch for $archive: expected $expected, got $actual"
if [ -n "${PREGATE_ARCHIVE:-}" ]; then
  verify_offline_signatures
else
  verify_release_signatures
fi

mkdir "$tmp/x"
tar -xzf "$archive" -C "$tmp/x"
[ -f "$tmp/x/pregate" ] && [ -x "$tmp/x/pregate" ] || die "the archive has no executable pregate"
# Gatekeeper would stop a quarantined binary that a browser downloaded; its hash is verified above.
if [ "$os" = Darwin ]; then xattr -d com.apple.quarantine "$tmp/x/pregate" 2>/dev/null || :; fi

# Not exec: the EXIT trap removes the ~66 MB binary once setup has copied it to <DATA>/<version>/.
"$tmp/x/pregate" setup
