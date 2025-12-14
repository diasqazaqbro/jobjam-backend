import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import axios, { AxiosInstance } from "axios";

export interface HHTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
}

export interface HHApplicationTokenResponse {
  access_token: string;
  token_type: string;
}

export interface HHUserInfo {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  middle_name?: string;
  phone?: string;
  is_applicant: boolean;
  is_employer: boolean;
  employer?: {
    id: string;
    name: string;
  };
}

export interface HHVacancy {
  id: string;
  name: string;
  area?: {
    name: string;
  };
  salary?: {
    from?: number;
    to?: number;
    currency?: string;
  };
  employer?: {
    id: string;
    name: string;
    logo_urls?: {
      original?: string;
    };
  };
  description?: string;
  requirement?: string;
  responsibility?: string;
  published_at: string;
  alternate_url: string;
  experience?: {
    id: string;
    name: string;
  };
  employment?: {
    id: string;
    name: string;
  };
  key_skills?: Array<{
    name: string;
  }>;
}

export interface HHVacanciesResponse {
  found: number;
  pages: number;
  per_page: number;
  page: number;
  items: HHVacancy[];
}

@Injectable()
export class HHApiService {
  private readonly logger = new Logger(HHApiService.name);
  private readonly baseURL = "https://api.hh.ru";
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly redirectUri: string;
  private readonly userAgent: string;

  constructor(private configService: ConfigService) {
    this.clientId = this.configService.get<string>("HH_CLIENT_ID") || "";
    this.clientSecret =
      this.configService.get<string>("HH_CLIENT_SECRET") || "";
    this.redirectUri =
      this.configService.get<string>("HH_REDIRECT_URI") ||
      "http://localhost:3001/auth/hh/callback";
    this.userAgent = "JobJam/1.0 (support@jobjam.kz)";
  }

  /**
   * Get OAuth authorization URL
   */
  getAuthorizationUrl(state?: string): string {
    const params = new URLSearchParams({
      response_type: "code",
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
    });

    if (state) {
      params.append("state", state);
    }

    return `https://hh.kz/oauth/authorize?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access token
   */
  async getAccessToken(code: string): Promise<HHTokenResponse> {
    try {
      const response = await axios.post<HHTokenResponse>(
        `${this.baseURL}/token`,
        new URLSearchParams({
          grant_type: "authorization_code",
          client_id: this.clientId,
          client_secret: this.clientSecret,
          code,
          redirect_uri: this.redirectUri,
        }),
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": this.userAgent,
          },
        }
      );

      return response.data;
    } catch (error: any) {
      this.logger.error(
        "Failed to get access token",
        error.response?.data || error.message
      );
      throw new Error("Failed to exchange authorization code for token");
    }
  }

  /**
   * Refresh access token
   */
  async refreshAccessToken(refreshToken: string): Promise<HHTokenResponse> {
    try {
      const response = await axios.post<HHTokenResponse>(
        `${this.baseURL}/token`,
        new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: refreshToken,
        }),
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": this.userAgent,
          },
        }
      );

      return response.data;
    } catch (error: any) {
      this.logger.error(
        "Failed to refresh token",
        error.response?.data || error.message
      );
      throw new Error("Failed to refresh access token");
    }
  }

  /**
   * Get application token (for mobile apps)
   * This token has unlimited lifetime and can be requested no more than once per 5 minutes
   * According to HH API docs, grant_type for application token is not specified,
   * but we try 'client_credentials' as it's standard for application tokens
   */
  async getApplicationToken(): Promise<HHApplicationTokenResponse> {
    try {
      // Try with client_credentials grant_type first
      const params = new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
      });

      // Add grant_type - according to HH docs it's required but type is not specified
      // We'll try 'client_credentials' as it's standard for app tokens
      params.append("grant_type", "client_credentials");

      const response = await axios.post<HHApplicationTokenResponse>(
        `${this.baseURL}/token`,
        params,
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": this.userAgent,
          },
        }
      );

      return response.data;
    } catch (error: any) {
      this.logger.error(
        "Failed to get application token",
        error.response?.data || error.message
      );

      // If client_credentials doesn't work, try without grant_type
      if (error.response?.status === 400) {
        this.logger.warn("Trying to get application token without grant_type");
        try {
          const params = new URLSearchParams({
            client_id: this.clientId,
            client_secret: this.clientSecret,
          });

          const response = await axios.post<HHApplicationTokenResponse>(
            `${this.baseURL}/token`,
            params,
            {
              headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "User-Agent": this.userAgent,
              },
            }
          );

          return response.data;
        } catch (retryError: any) {
          this.logger.error(
            "Failed to get application token without grant_type",
            retryError.response?.data || retryError.message
          );
          throw new Error("Failed to get application token from HeadHunter");
        }
      }

      throw new Error("Failed to get application token from HeadHunter");
    }
  }

  /**
   * Get user info from HH API
   */
  async getUserInfo(accessToken: string): Promise<HHUserInfo> {
    try {
      const response = await axios.get<HHUserInfo>(`${this.baseURL}/me`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "HH-User-Agent": this.userAgent,
        },
        params: {
          host: "hh.kz",
        },
      });

      return response.data;
    } catch (error: any) {
      this.logger.error(
        "Failed to get user info",
        error.response?.data || error.message
      );
      throw new Error("Failed to get user info from HeadHunter");
    }
  }

  /**
   * Get vacancies from HH API
   */
  async getVacancies(
    accessToken: string,
    params?: {
      page?: number;
      per_page?: number;
      area?: string;
      salary?: number;
      experience?: string;
      employment?: string;
      text?: string;
    }
  ): Promise<HHVacanciesResponse> {
    try {
      const queryParams: any = {
        host: "hh.kz",
        page: params?.page || 0,
        per_page: params?.per_page || 20,
      };

      if (params?.area) queryParams.area = params.area;
      if (params?.salary) queryParams.salary = params.salary;
      if (params?.experience) queryParams.experience = params.experience;
      if (params?.employment) queryParams.employment = params.employment;
      if (params?.text) queryParams.text = params.text;

      const response = await axios.get<HHVacanciesResponse>(
        `${this.baseURL}/vacancies`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "HH-User-Agent": this.userAgent,
          },
          params: queryParams,
        }
      );

      return response.data;
    } catch (error: any) {
      this.logger.error(
        "Failed to get vacancies",
        error.response?.data || error.message
      );
      throw new Error("Failed to get vacancies from HeadHunter");
    }
  }

  /**
   * Get single vacancy by ID
   */
  async getVacancy(accessToken: string, vacancyId: string): Promise<HHVacancy> {
    try {
      const response = await axios.get<HHVacancy>(
        `${this.baseURL}/vacancies/${vacancyId}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "HH-User-Agent": this.userAgent,
          },
          params: {
            host: "hh.kz",
          },
        }
      );

      return response.data;
    } catch (error: any) {
      this.logger.error(
        "Failed to get vacancy",
        error.response?.data || error.message
      );
      throw new Error("Failed to get vacancy from HeadHunter");
    }
  }

  /**
   * Get resumes from HH API (GET /resumes/mine)
   */
  async getResumes(accessToken: string): Promise<{
    found: number;
    items: any[];
    page: number;
    pages: number;
    per_page: number;
  }> {
    try {
      const response = await axios.get(`${this.baseURL}/resumes/mine`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "HH-User-Agent": this.userAgent,
        },
        params: {
          host: "hh.kz",
        },
      });

      return response.data;
    } catch (error: any) {
      this.logger.error(
        "Failed to get resumes",
        error.response?.data || error.message
      );
      throw new Error("Failed to get resumes from HeadHunter");
    }
  }

  /**
   * Get single resume by ID from HH API
   */
  async getResume(accessToken: string, resumeId: string): Promise<any> {
    try {
      const response = await axios.get(`${this.baseURL}/resumes/${resumeId}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "HH-User-Agent": this.userAgent,
        },
        params: {
          host: "hh.kz",
        },
      });

      return response.data;
    } catch (error: any) {
      this.logger.error(
        "Failed to get resume",
        error.response?.data || error.message
      );
      throw new Error("Failed to get resume from HeadHunter");
    }
  }

  /**
   * Create resume profile via HH API (POST /resume_profile)
   */
  async createResumeProfile(
    accessToken: string,
    data: {
      entry_point?: string;
      vacancy_id?: number;
      resume: any;
      profile?: any;
      creds?: any;
      additional_properties?: any;
    }
  ): Promise<any> {
    try {
      const response = await axios.post(
        `${this.baseURL}/resume_profile`,
        data,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "HH-User-Agent": this.userAgent,
            "Content-Type": "application/json",
          },
          params: {
            host: "hh.kz",
          },
        }
      );

      return response.data;
    } catch (error: any) {
      this.logger.error(
        "Failed to create resume profile",
        error.response?.data || error.message
      );
      throw new Error("Failed to create resume profile on HeadHunter");
    }
  }

  /**
   * Update resume profile via HH API (PUT /resume_profile/{resume_id})
   */
  async updateResumeProfile(
    accessToken: string,
    resumeId: string,
    data: any,
    host: string = 'hh.kz',
    locale: string = 'RU',
  ): Promise<any> {
    try {
      this.logger.log(`Updating resume profile ${resumeId}...`);
      
      const response = await axios.put(
        `${this.baseURL}/resume_profile/${resumeId}`,
        data,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'HH-User-Agent': this.userAgent,
            'Content-Type': 'application/json',
          },
          params: {
            host,
            locale,
          },
        },
      );
      
      this.logger.log(`Resume profile ${resumeId} updated successfully`);
      return response.data;
    } catch (error: any) {
      this.logger.error(
        `Failed to update resume profile ${resumeId}`,
        error.response?.data || error.message,
      );
      throw new Error('Failed to update resume profile on HeadHunter');
    }
  }

  /**
   * Publish resume via HH API (POST /resumes/{resume_id}/publish)
   */
  async publishResume(
    accessToken: string,
    resumeId: string,
    host: string = 'hh.kz',
    locale: string = 'RU',
  ): Promise<void> {
    try {
      this.logger.log(`📢 Публикация резюме ${resumeId}...`);

      await axios.post(
        `${this.baseURL}/resumes/${resumeId}/publish`,
        {},
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'HH-User-Agent': this.userAgent,
          },
          params: {
            host,
            locale,
          },
        },
      );

      this.logger.log(`✅ Резюме ${resumeId} успешно опубликовано!`);
    } catch (error: any) {
      const status = error.response?.status;
      const errorData = error.response?.data;

      if (status === 429) {
        this.logger.warn(`⏳ Резюме ${resumeId} еще нельзя обновить (next_publish_at не наступил)`);
        this.logger.warn(`   Резюме уже опубликовано, пропускаем публикацию`);
        return; // Not a critical error, resume is already published
      } else if (status === 400) {
        this.logger.warn(`⚠️ Публикация резюме ${resumeId} невозможна: ${errorData?.description || 'Bad request'}`);
        return; // Not critical, continue
      } else if (status === 404) {
        this.logger.error(`❌ Резюме ${resumeId} не найдено`);
        throw new Error('Resume not found for publishing');
      } else {
        this.logger.error(
          `Failed to publish resume ${resumeId}`,
          errorData || error.message,
        );
        throw new Error('Failed to publish resume on HeadHunter');
      }
    }
  }

  /**
   * Apply to vacancy via HH API (POST /negotiations)
   */
  async applyToVacancy(
    accessToken: string,
    vacancyId: string,
    resumeId: string,
    coverLetter?: string,
    host: string = 'hh.kz',
    locale: string = 'RU',
  ): Promise<any> {
    try {
      this.logger.log(`📨 Отправка отклика на вакансию ${vacancyId} с резюме ${resumeId}...`);

      // Create FormData for multipart/form-data
      const FormData = require('form-data');
      const formData = new FormData();
      formData.append('vacancy_id', vacancyId);
      formData.append('resume_id', resumeId);
      if (coverLetter) {
        formData.append('message', coverLetter);
      }

      const response = await axios.post(
        `${this.baseURL}/negotiations`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'HH-User-Agent': this.userAgent,
            ...formData.getHeaders(),
          },
          params: {
            host,
            locale,
          },
        }
      );

      this.logger.log(`✅ Отклик успешно отправлен!`);
      return response.data;
    } catch (error: any) {
      const status = error.response?.status;
      const errorData = error.response?.data;

      if (status === 400) {
        this.logger.error(`❌ Ошибка в параметрах отклика: ${errorData?.description || 'Bad request'}`);
        throw new Error(`Bad request: ${errorData?.description || 'Invalid parameters'}`);
      } else if (status === 403) {
        this.logger.error(`❌ Невозможно откликнуться на вакансию ${vacancyId}`);
        throw new Error('Forbidden: Cannot apply to this vacancy');
      } else {
        this.logger.error(
          'Failed to apply to vacancy',
          errorData || error.message
        );
        throw new Error('Failed to apply to vacancy on HeadHunter');
      }
    }
  }

  /**
   * Get vacancies similar to resume (GET /resumes/{resume_id}/similar_vacancies)
   */
  async getSimilarVacancies(
    accessToken: string,
    resumeId: string,
    params?: {
      page?: number;
      per_page?: number;
      text?: string;
      area?: string;
      salary?: number;
      only_with_salary?: boolean;
      period?: number;
    },
    host: string = 'hh.kz',
    locale: string = 'RU',
  ): Promise<{
    found: number;
    items: any[];
    page: number;
    pages: number;
    per_page: number;
  }> {
    try {
      this.logger.log(`🔍 Поиск вакансий похожих на резюме ${resumeId}...`);

      const response = await axios.get(
        `${this.baseURL}/resumes/${resumeId}/similar_vacancies`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'HH-User-Agent': this.userAgent,
          },
          params: {
            host,
            locale,
            ...params,
          },
        }
      );

      this.logger.log(`✅ Найдено ${response.data.found} похожих вакансий`);
      return response.data;
    } catch (error: any) {
      const status = error.response?.status;
      const errorData = error.response?.data;

      if (status === 404) {
        this.logger.error(`❌ Резюме ${resumeId} не найдено`);
        throw new Error('Resume not found');
      } else if (status === 400) {
        this.logger.error(`❌ Ошибка в параметрах запроса: ${errorData?.description || 'Bad request'}`);
        throw new Error(`Bad request: ${errorData?.description || 'Invalid parameters'}`);
      } else {
        this.logger.error(
          `Failed to get similar vacancies for resume ${resumeId}`,
          errorData || error.message
        );
        throw new Error('Failed to get similar vacancies from HeadHunter');
      }
    }
  }

  /**
   * Create axios instance with HH token
   */
  createApiClient(accessToken: string): AxiosInstance {
    return axios.create({
      baseURL: this.baseURL,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "HH-User-Agent": this.userAgent,
      },
    });
  }
}
