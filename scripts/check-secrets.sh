#!/bin/sh
# Owlery publish guard. Run before committing:   sh scripts/check-secrets.sh
# It inspects what is STAGED (git add) and fails if anything private is about to be published:
#   - secret keys, tokens, JWTs, private keys, database passwords
#   - your REAL config.js, or the real Giphy key / Supabase URL / publishable key (they live in GitHub Secrets, not the repo)
#   - email addresses and personal file paths
# To run it automatically on every commit (optional, one time):   cp scripts/check-secrets.sh .git/hooks/pre-commit
# (Only if you have reviewed a hit and are certain it is fine:  git commit --no-verify)

files=$(git diff --cached --name-only --diff-filter=ACM)
[ -z "$files" ] && { echo "Nothing staged."; exit 0; }
bad=0

# 1) file names that must never be committed
for f in $files; do
  case "$f" in
    config.js|*/config.js)
      echo "BLOCKED: '$f' holds your real keys. It is gitignored on purpose; commit config.example.js instead."; bad=1;;
    supabase/create-accounts.sql)
      echo "BLOCKED: '$f' holds real emails and passwords. Only supabase/create-accounts.example.sql may be committed."; bad=1;;
    .env|.env.*|*.env|*.pem|*.key|*.p12|*.pfx|*.ppk|id_rsa*|id_ed25519*|*service-account*.json|*credentials*.json|*-adminsdk-*.json|*.sqlite|*.db|*.dump|tests/*)
      echo "BLOCKED: '$f' looks like a secrets / local-only file. Unstage it:  git restore --staged '$f'"; bad=1;;
  esac
done

added=$(git diff --cached -U0 --no-color -- $files | grep -E '^\+' | grep -vE '^\+\+\+ ')

# 2) secrets and the real project identifiers
pat='sb_secret_[A-Za-z0-9_-]{10,}|sb_publishable_[A-Za-z0-9_-]{20,}|-----BEGIN [A-Z ]*PRIVATE KEY-----|AKIA[0-9A-Z]{16}|gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9_-]{20,}|sk_live_[A-Za-z0-9]{10,}|xox[baprs]-[A-Za-z0-9-]{10,}|eyJ[A-Za-z0-9_-]{15,}\.eyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{10,}|postgres(ql)?://[^[:space:]:@]+:[^[:space:]@]+@|https://[a-z0-9]{20}\.supabase\.co|GIPHY_KEY:[[:space:]]*.[A-Za-z0-9]{16,}|C:\\Users\\|/Users/[A-Za-z]'
hits=$(printf '%s\n' "$added" | grep -E "$pat")
if [ -n "$hits" ]; then
  echo "BLOCKED: this commit adds a key, token, password, project URL or personal path:"
  echo "$hits" | cut -c1-110 | sed 's/^/    /'
  echo "Keys belong in config.js (gitignored) and in GitHub Secrets, never in a committed file."
  echo "A Supabase 'service_role' / secret key or a DB password must NEVER leave your Supabase dashboard. Rotate it if it was ever shared."
  bad=1
fi

# 3) email addresses (placeholders and GitHub no-reply addresses are fine)
emails=$(printf '%s\n' "$added" | grep -oE '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}' | grep -viE '@(example\.|users\.noreply\.github\.com)|\.test$')
if [ -n "$emails" ]; then
  echo "BLOCKED: this commit contains an email address (it would be public):"; echo "$emails" | sort -u | sed 's/^/    /'; bad=1
fi

[ "$bad" = 0 ] && echo "Publish check passed: no keys, secrets, emails or personal paths are staged."
exit $bad
