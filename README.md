# PROJECT NAME

below are common sections that you may like to populate or leave empty to populate later. refer to the template repo `WesternDeveloperSociety/project-spec-template` for the default.

## Purpose

*what and who is this project for?*

## Contribution

*add instructions on how to contribute to this repository, below is an example*

1. Create a branch off of `dev` branch named in the format `<name>/type-title-of-this-branch`.
    - valid types include:
        - feat: feature
        - fix: bug fix
        - refact: refactor
        - docs: documentation
        - chore: a chore

2. Once development is concluded, open a pull request from your branch back to the `dev` branch.

## Branches

- `dev`: where contributions are made
- `qa`: contains a functional version of code to be tested
- `prod`: production ready code to be released

## Development

*add instructions on how to start the dev environment, below is an example*

1. Install dependencies

```bash
npm i
```

2. Start development server

```bash
npm run dev
```

## Deployment

*add instructions on how to deploy this project (in applicable), below is an example*

1. Ensure `NODE_ENV=production`

```bash
echo "NODE_ENV=production" > .env
```

2. Install production dependencies

```bash
npm i
```

3. Start production server

```bash
npm run start
```

## Contributors

*give yourself some credit*

Team Leads:
- Bob
- His friends

Developers:
- Robert
- John
- A few more friends

