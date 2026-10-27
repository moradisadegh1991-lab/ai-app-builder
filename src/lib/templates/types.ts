export interface GeneratedFile {
  path: string;
  content: string;
  /** Marks shell scripts that must be committed with the executable bit. */
  executable?: boolean;
}
