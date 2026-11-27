#!/usr/bin/env bash
# Publish the live site to a separate branch, without a second checkout and
# without a zip.
#
# The working branch (`arena/…`) is the whole workshop: app, tests, the Pages
# export, notes. This script takes that branch, drops everything that is not
# part of the site, and commits the remainder onto `final` — a fresh commit on
# top of the previous one, so the push is a plain fast-forward.
#
#   ./publish-final.sh                 # final ← origin/arena/6b38c6e9-school-store
#   DEST_BRANCH=live ./publish-final.sh
#   DEST_REMOTE=/tmp/mirror.git ./publish-final.sh   # try it without pushing anywhere real
#
# Nothing is checked out, switched or reset: the commit is built in a temporary
# index, so your working tree is never touched.
set -euo pipefail

SRC_REF="${SRC_REF:-origin/arena/6b38c6e9-school-store}"
DEST_REMOTE="${DEST_REMOTE:-origin}"
DEST_BRANCH="${DEST_BRANCH:-final}"

# Kept in this order: directories first, then the root files.
DROP=(
  qa docs .arena .pglite .pgdata out .next node_modules
  index.html
  README.md SUPABASE.md DEPLOY.md STACKBLITZ.md TICKETS.md PUBLISH.md PUSH-ME.md
  stackblitz.config.json
  publish-final.sh final-site.tar.gz realign.sh
  tsconfig.tsbuildinfo next-env.d.ts
)

git fetch --quiet origin "+refs/heads/${SRC_REF#origin/}:refs/remotes/${SRC_REF}"

src=$(git rev-parse --verify "$SRC_REF")
short=$(git rev-parse --short "$src")

work=$(mktemp -d)
trap 'rm -rf "$work" "$work.index"' EXIT

git archive "$src" | tar -x -C "$work"
for path in "${DROP[@]}"; do rm -rf "${work:?}/$path"; done

# A temporary index, so the real one keeps exactly what you were doing. The
# staged files live in the temp directory, so both the index *and* the work tree
# have to be pointed somewhere else for these three commands.
gitdir=$(git rev-parse --absolute-git-dir)
export GIT_DIR="$gitdir" GIT_WORK_TREE="$work" GIT_INDEX_FILE="$work.index"
git read-tree --empty
git add -A
tree=$(git write-tree)
unset GIT_WORK_TREE

# The branch being published to may live on another remote entirely, so ask that
# remote for its tip and keep the answer under a private ref.
git update-ref -d "refs/final-publish/${DEST_BRANCH}" 2>/dev/null || true
git fetch --quiet "$DEST_REMOTE" "+refs/heads/${DEST_BRANCH}:refs/final-publish/${DEST_BRANCH}" 2>/dev/null || true
base=$(git rev-parse --verify --quiet "refs/final-publish/${DEST_BRANCH}" || true)

if [ -n "$base" ] && [ "$(git rev-parse "${base}^{tree}")" = "$tree" ]; then
  echo "Nothing to publish: ${DEST_BRANCH} already matches ${SRC_REF} (${short})."
  exit 0
fi

args=(-m "Live site: ${SRC_REF} at ${short}")
[ -n "$base" ] && args+=(-p "$base")

commit=$(git commit-tree "$tree" "${args[@]}")
count=$(git ls-tree -r --name-only "$tree" | wc -l | tr -d ' ')

git push --quiet "$DEST_REMOTE" "${commit}:refs/heads/${DEST_BRANCH}"
echo "Published ${count} files to ${DEST_REMOTE}/${DEST_BRANCH} as ${commit:0:7} (${short})."
