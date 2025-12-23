
# Obsidian Open in New Tab (Enhanced Version)

This is a forked and enhanced version of [patleeman/obsidian-open-in-new-tab](https://github.com/patleeman/obsidian-open-in-new-tab). It includes additional logic to conditionally control tab behavior based on file metadata.

## Key Enhancements

Unlike the original plugin that opens *all* files in a new tab, this version allows for **conditional tab management** using YAML frontmatter properties.

* **Conditional New Tab**: Decide whether to open a file in a new tab or the current tab based on its YAML properties.
    * **Rule Management**: Add/Delete multiple Key-Value pairs in the settings tab to define exceptions.
    * **Deep Path Resolution**: Enhanced file path detection that works accurately even for files nested deep within subdirectories.
    * **Type-Safe Comparison**: Robust comparison logic that handles string, number, and boolean YAML values correctly.

## How to Use

1. Go to **Settings > Open in New Tab**.
2. Add a new rule (e.g., `type` : `hub`).
3. If a file has `type: hub` in its YAML frontmatter, it will open in the **current tab**.
4. All other files will continue to open in a **new tab** by default.

## Technical Improvements

* **Metadata Cache Integration**: Uses Obsidian's `metadataCache` for high-performance, I/O-free property lookups.
* **Improved Path Discovery**: Implemented `getFirstLinkpathDest` to resolve relative links to absolute vault paths.
* **Monkey Patching**: Robust wrapping of `Workspace.openLinkText` using `monkey-around`.
