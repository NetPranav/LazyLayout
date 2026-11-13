#!/bin/zsh
# Merges PRs in order, only when GitHub itself allows it (no --admin). Stops on a failed required check.
R=NetPranav/LazyLayout
merge_when_ready() {
  local n=$1 subject=$2 tries=0
  while (( tries < 90 )); do
    state=$(gh pr view $n --repo $R --json state -q .state)
    [[ $state == MERGED ]] && { echo "#$n already merged"; return 0; }
    fails=$(gh pr checks $n --repo $R 2>/dev/null | awk -F'\t' '$2=="fail" && $1!~/Vercel/ {print $1}' | tr '\n' ',')
    if [[ -n $fails ]]; then echo "#$n STOPPED: failed checks: $fails"; return 1; fi
    out=$(gh pr merge $n --repo $R --squash --subject "$subject" 2>&1)
    state=$(gh pr view $n --repo $R --json state -q .state)
    if [[ $state == MERGED ]]; then echo "#$n MERGED"; return 0; fi
    if echo "$out" | grep -qi "out of date\|behind"; then gh pr update-branch $n --repo $R >/dev/null 2>&1 && echo "#$n branch updated, waiting for CI again"; fi
    sleep 60; tries=$((tries+1))
  done
  echo "#$n TIMEOUT waiting: $out"; return 1
}
merge_when_ready 86 "feat(motion): wire Phases 64-71 into the new editor; View > Show keystrokes (#86)" || exit 1
merge_when_ready 87 "docs: Phases 69-73 catch-up (roadmap, changelog, B test guide, user manual) (#87)" || exit 1
merge_when_ready 88 "feat(render): Phase 74 blend modes, adjustment layers, masks (animatable) (#88)" || exit 1
echo "FIRST THREE MERGED"
