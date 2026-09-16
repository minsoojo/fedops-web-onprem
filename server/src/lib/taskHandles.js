export const ownerHandleFilter = (handle) => ({
  $or: [
    { ownerHandle: handle },
    { ownerHandleAliases: handle },
  ],
});
