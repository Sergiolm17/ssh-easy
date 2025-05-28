This is a Flow Launcher plugin for managing SSH connections and performing SCP transfers directly or using saved profiles.

The plugin allows you to:

- **Connect directly via SSH:** Use the `ssh d user@host` command.
- **Manage SSH Profiles:**
  - `ssh profiles`: List all saved profiles.
  - `ssh add <profile_name> <user@host>`: Save a new profile.
  - `ssh remove <profile_name>`: Remove an existing profile.
- **Perform Direct SCP Transfers:** Use `ssh scp d <source_path> <user@host>:<destination_path>`.
- **Perform Profile SCP Transfers:** Use `ssh scp profiles <profile_name> <source_path> <destination_path>`.

SSH profiles are stored in `ssh_profiles.json` in the plugin directory.

The modules used in this plugin are kept in the node_modules folder, built by the GitHub workflow during release publish.
