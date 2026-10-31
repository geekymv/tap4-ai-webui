export type NavigationCategory = {
  create_by: number | null;
  create_time: string;
  del_flag: number | null;
  id: number;
  name: string;
  sort: number | null;
  title: string;
};

export type Submit = {
  created_at: string;
  email: string | null;
  id: number;
  is_feature: number | null;
  name: string | null;
  status: number | null;
  url: string | null;
};

export type WebNavigation = {
  category_name: string;
  collection_time: string;
  content: string;
  detail: string;
  id: number;
  image_url: string;
  name: string;
  star_rating: number;
  tag_name: string;
  thumbnail_url: string;
  title: string;
  url: string;
  website_data: string;
};
