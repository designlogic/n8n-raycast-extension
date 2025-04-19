export const Cache = jest.fn().mockImplementation(() => ({
  get: jest.fn(),
  set: jest.fn(),
  remove: jest.fn(),
}));

export const getPreferenceValues = jest.fn();

export const showToast = jest.fn();

export const Toast = {
  Style: {
    Animated: "animated",
    Success: "success",
    Failure: "failure",
  },
};

export const Icon = {
  Dot: "dot",
  Tag: "tag",
  Hashtag: "hashtag",
  RotateClockwise: "rotate-clockwise",
};

export const Color = {
  Red: "red",
  Blue: "blue",
  Green: "green",
};
