// Shared by the server layout (reads the cookie, renders the sidebar content)
// and the client shell (writes the cookie, sets data-collapsed). The class
// strings key off the shell's group: the rail only applies at 960px and up.

export const SIDEBAR_COOKIE = "sidebar";
export const SIDEBAR_COLLAPSED = "collapsed";

// Visible text that becomes screen-reader-only in the icon rail.
export const RAIL_HIDE = "min-[960px]:group-data-collapsed/shell:sr-only";

// Rows that center their icon in the rail.
export const RAIL_CENTER =
  "min-[960px]:group-data-collapsed/shell:justify-center min-[960px]:group-data-collapsed/shell:px-0";
