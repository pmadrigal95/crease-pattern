# Security policy

## Supported versions

Only the version currently deployed from `main` is supported. Fixes are released as new
deployments, not as patches to older versions.

## Reporting a vulnerability

Please **do not open a public issue** for security problems.

Report privately through GitHub: go to the **Security** tab of this repository and choose
**Report a vulnerability**. If that is not available to you, write to
pablomadrigal.1995@gmail.com with the subject `Security: crease-pattern`.

Please include:

- what you found and where (URL or file),
- steps to reproduce it,
- the impact you expect.

You can expect a first reply within 7 days. Once a fix is deployed, you will be credited in the
release notes unless you prefer to stay anonymous.

## Scope

In scope: the site served from this repository, its build and deploy pipeline, and any Worker
endpoints defined here.

Out of scope: third-party services (GitHub, Cloudflare, font providers), denial of service, and
reports produced only by automated scanners without a demonstrated impact.
