export const getMatchStatusDisplay = (status: string) => {
  switch (status) {
    case "CREATED":
      return "Waiting for players...";
    case "ACTIVE":
      return "Match in progress...";
    case "COMPLETED":
      return "Match completed";
    case "SETTLED":
      return "Match settled";
    default:
      return "Unknown match status";
  }
};
