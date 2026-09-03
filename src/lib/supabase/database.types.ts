export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      admin_profiles: {
        Row: {
          created_at: string
          user_id: string
          username: string
        }
        Insert: {
          created_at?: string
          user_id: string
          username: string
        }
        Update: {
          created_at?: string
          user_id?: string
          username?: string
        }
        Relationships: []
      }
      admins_caisse: {
        Row: {
          caisse_id: string
          created_at: string
          membre_id: string | null
          user_id: string
        }
        Insert: {
          caisse_id: string
          created_at?: string
          membre_id?: string | null
          user_id: string
        }
        Update: {
          caisse_id?: string
          created_at?: string
          membre_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "admins_caisse_caisse_id_fkey"
            columns: ["caisse_id"]
            isOneToOne: false
            referencedRelation: "caisses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admins_caisse_caisse_id_fkey"
            columns: ["caisse_id"]
            isOneToOne: false
            referencedRelation: "v_caisse_solde"
            referencedColumns: ["caisse_id"]
          },
          {
            foreignKeyName: "admins_caisse_membre_id_fkey"
            columns: ["membre_id"]
            isOneToOne: false
            referencedRelation: "membres"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admins_caisse_membre_id_fkey"
            columns: ["membre_id"]
            isOneToOne: false
            referencedRelation: "v_membre_situation"
            referencedColumns: ["membre_id"]
          },
        ]
      }
      amendes: {
        Row: {
          caisse_id: string
          cotisation_mois: string | null
          created_at: string
          declaree_par_user_id: string
          id: string
          jour_match: boolean
          libelle: string
          membre_id: string
          montant_centimes: number
          motif_id: string | null
          motif_suppression: string | null
          supprimee_at: string | null
          supprimee_par_user_id: string | null
        }
        Insert: {
          caisse_id: string
          cotisation_mois?: string | null
          created_at?: string
          declaree_par_user_id: string
          id?: string
          jour_match?: boolean
          libelle: string
          membre_id: string
          montant_centimes: number
          motif_id?: string | null
          motif_suppression?: string | null
          supprimee_at?: string | null
          supprimee_par_user_id?: string | null
        }
        Update: {
          caisse_id?: string
          cotisation_mois?: string | null
          created_at?: string
          declaree_par_user_id?: string
          id?: string
          jour_match?: boolean
          libelle?: string
          membre_id?: string
          montant_centimes?: number
          motif_id?: string | null
          motif_suppression?: string | null
          supprimee_at?: string | null
          supprimee_par_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "amendes_caisse_id_fkey"
            columns: ["caisse_id"]
            isOneToOne: false
            referencedRelation: "caisses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "amendes_caisse_id_fkey"
            columns: ["caisse_id"]
            isOneToOne: false
            referencedRelation: "v_caisse_solde"
            referencedColumns: ["caisse_id"]
          },
          {
            foreignKeyName: "amendes_membre_id_fkey"
            columns: ["membre_id"]
            isOneToOne: false
            referencedRelation: "membres"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "amendes_membre_id_fkey"
            columns: ["membre_id"]
            isOneToOne: false
            referencedRelation: "v_membre_situation"
            referencedColumns: ["membre_id"]
          },
          {
            foreignKeyName: "amendes_motif_id_fkey"
            columns: ["motif_id"]
            isOneToOne: false
            referencedRelation: "motifs_amende"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          acteur_membre_id: string | null
          acteur_user_id: string | null
          action: string
          caisse_id: string | null
          created_at: string
          entite_id: string | null
          entite_type: string | null
          id: string
          payload: Json
        }
        Insert: {
          acteur_membre_id?: string | null
          acteur_user_id?: string | null
          action: string
          caisse_id?: string | null
          created_at?: string
          entite_id?: string | null
          entite_type?: string | null
          id?: string
          payload?: Json
        }
        Update: {
          acteur_membre_id?: string | null
          acteur_user_id?: string | null
          action?: string
          caisse_id?: string | null
          created_at?: string
          entite_id?: string | null
          entite_type?: string | null
          id?: string
          payload?: Json
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_acteur_membre_id_fkey"
            columns: ["acteur_membre_id"]
            isOneToOne: false
            referencedRelation: "membres"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_log_acteur_membre_id_fkey"
            columns: ["acteur_membre_id"]
            isOneToOne: false
            referencedRelation: "v_membre_situation"
            referencedColumns: ["membre_id"]
          },
          {
            foreignKeyName: "audit_log_caisse_id_fkey"
            columns: ["caisse_id"]
            isOneToOne: false
            referencedRelation: "caisses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_log_caisse_id_fkey"
            columns: ["caisse_id"]
            isOneToOne: false
            referencedRelation: "v_caisse_solde"
            referencedColumns: ["caisse_id"]
          },
        ]
      }
      caisses: {
        Row: {
          cloturee_at: string | null
          code: string
          cotisation_active: boolean
          cotisation_montant_centimes: number
          cotisation_plafonnee_par_amendes: boolean
          cotisation_solde_pris_en_compte: boolean
          created_at: string
          createur_id: string
          description: string | null
          id: string
          nom: string
          updated_at: string
        }
        Insert: {
          cloturee_at?: string | null
          code: string
          cotisation_active?: boolean
          cotisation_montant_centimes?: number
          cotisation_plafonnee_par_amendes?: boolean
          cotisation_solde_pris_en_compte?: boolean
          created_at?: string
          createur_id: string
          description?: string | null
          id?: string
          nom: string
          updated_at?: string
        }
        Update: {
          cloturee_at?: string | null
          code?: string
          cotisation_active?: boolean
          cotisation_montant_centimes?: number
          cotisation_plafonnee_par_amendes?: boolean
          cotisation_solde_pris_en_compte?: boolean
          created_at?: string
          createur_id?: string
          description?: string | null
          id?: string
          nom?: string
          updated_at?: string
        }
        Relationships: []
      }
      membres: {
        Row: {
          actif: boolean
          caisse_id: string
          created_at: string
          id: string
          nom: string
          password_hash: string | null
          updated_at: string
        }
        Insert: {
          actif?: boolean
          caisse_id: string
          created_at?: string
          id?: string
          nom: string
          password_hash?: string | null
          updated_at?: string
        }
        Update: {
          actif?: boolean
          caisse_id?: string
          created_at?: string
          id?: string
          nom?: string
          password_hash?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "membres_caisse_id_fkey"
            columns: ["caisse_id"]
            isOneToOne: false
            referencedRelation: "caisses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "membres_caisse_id_fkey"
            columns: ["caisse_id"]
            isOneToOne: false
            referencedRelation: "v_caisse_solde"
            referencedColumns: ["caisse_id"]
          },
        ]
      }
      motifs_amende: {
        Row: {
          actif: boolean
          caisse_id: string
          created_at: string
          id: string
          libelle: string
          montant_centimes: number
          montant_variable: boolean
          updated_at: string
        }
        Insert: {
          actif?: boolean
          caisse_id: string
          created_at?: string
          id?: string
          libelle: string
          montant_centimes: number
          montant_variable?: boolean
          updated_at?: string
        }
        Update: {
          actif?: boolean
          caisse_id?: string
          created_at?: string
          id?: string
          libelle?: string
          montant_centimes?: number
          montant_variable?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "motifs_amende_caisse_id_fkey"
            columns: ["caisse_id"]
            isOneToOne: false
            referencedRelation: "caisses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "motifs_amende_caisse_id_fkey"
            columns: ["caisse_id"]
            isOneToOne: false
            referencedRelation: "v_caisse_solde"
            referencedColumns: ["caisse_id"]
          },
        ]
      }
      paiements: {
        Row: {
          caisse_id: string
          created_at: string
          enregistre_par_user_id: string
          id: string
          membre_id: string
          montant_centimes: number
          motif_suppression: string | null
          moyen: Database["public"]["Enums"]["moyen_paiement"]
          supprimee_at: string | null
          supprimee_par_user_id: string | null
        }
        Insert: {
          caisse_id: string
          created_at?: string
          enregistre_par_user_id: string
          id?: string
          membre_id: string
          montant_centimes: number
          motif_suppression?: string | null
          moyen: Database["public"]["Enums"]["moyen_paiement"]
          supprimee_at?: string | null
          supprimee_par_user_id?: string | null
        }
        Update: {
          caisse_id?: string
          created_at?: string
          enregistre_par_user_id?: string
          id?: string
          membre_id?: string
          montant_centimes?: number
          motif_suppression?: string | null
          moyen?: Database["public"]["Enums"]["moyen_paiement"]
          supprimee_at?: string | null
          supprimee_par_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "paiements_caisse_id_fkey"
            columns: ["caisse_id"]
            isOneToOne: false
            referencedRelation: "caisses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "paiements_caisse_id_fkey"
            columns: ["caisse_id"]
            isOneToOne: false
            referencedRelation: "v_caisse_solde"
            referencedColumns: ["caisse_id"]
          },
          {
            foreignKeyName: "paiements_membre_id_fkey"
            columns: ["membre_id"]
            isOneToOne: false
            referencedRelation: "membres"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "paiements_membre_id_fkey"
            columns: ["membre_id"]
            isOneToOne: false
            referencedRelation: "v_membre_situation"
            referencedColumns: ["membre_id"]
          },
        ]
      }
      retraits: {
        Row: {
          caisse_id: string
          created_at: string
          enregistre_par_user_id: string
          id: string
          libelle: string
          montant_centimes: number
        }
        Insert: {
          caisse_id: string
          created_at?: string
          enregistre_par_user_id: string
          id?: string
          libelle: string
          montant_centimes: number
        }
        Update: {
          caisse_id?: string
          created_at?: string
          enregistre_par_user_id?: string
          id?: string
          libelle?: string
          montant_centimes?: number
        }
        Relationships: [
          {
            foreignKeyName: "retraits_caisse_id_fkey"
            columns: ["caisse_id"]
            isOneToOne: false
            referencedRelation: "caisses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "retraits_caisse_id_fkey"
            columns: ["caisse_id"]
            isOneToOne: false
            referencedRelation: "v_caisse_solde"
            referencedColumns: ["caisse_id"]
          },
        ]
      }
      super_admins: {
        Row: {
          created_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      v_caisse_solde: {
        Row: {
          caisse_id: string | null
          solde_centimes: number | null
          total_paiements_centimes: number | null
          total_retraits_centimes: number | null
        }
        Relationships: []
      }
      v_membre_situation: {
        Row: {
          caisse_id: string | null
          membre_id: string | null
          solde_centimes: number | null
          total_amendes_centimes: number | null
          total_paiements_centimes: number | null
        }
        Relationships: [
          {
            foreignKeyName: "membres_caisse_id_fkey"
            columns: ["caisse_id"]
            isOneToOne: false
            referencedRelation: "caisses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "membres_caisse_id_fkey"
            columns: ["caisse_id"]
            isOneToOne: false
            referencedRelation: "v_caisse_solde"
            referencedColumns: ["caisse_id"]
          },
        ]
      }
    }
    Functions: {
      caisse_est_ouverte: { Args: { p_caisse_id: string }; Returns: boolean }
      cloturer_caisse: { Args: { p_caisse_id: string }; Returns: undefined }
      current_membre_id: { Args: never; Returns: string }
      generer_cotisations_mois: {
        Args: { p_caisse_id: string; p_mois: string }
        Returns: number
      }
      is_admin_of: { Args: { p_caisse_id: string }; Returns: boolean }
      is_createur_of: { Args: { p_caisse_id: string }; Returns: boolean }
      is_linked_admin_membre: {
        Args: { p_membre_id: string }
        Returns: boolean
      }
      is_membre_of: { Args: { p_caisse_id: string }; Returns: boolean }
      is_super_admin: { Args: never; Returns: boolean }
      reouvrir_caisse: { Args: { p_caisse_id: string }; Returns: undefined }
      resolve_username_email: { Args: { p_username: string }; Returns: string }
      situation_caisse_mois: {
        Args: { p_caisse_id: string; p_mois: string }
        Returns: {
          actif: boolean
          amendes_mois_centimes: number
          avance_centimes: number
          cotisation_mois_centimes: number
          membre_id: string
          montant_a_payer_centimes: number
          nom: string
          paiements_mois_centimes: number
          solde_apres_centimes: number
          solde_avant_centimes: number
        }[]
      }
      situation_membre_par_mois: {
        Args: { p_membre_id: string }
        Returns: {
          amendes_centimes: number
          mois: string
          paiements_centimes: number
          solde_cumul_centimes: number
          solde_mois_centimes: number
        }[]
      }
      supprimer_amende: {
        Args: { p_amende_id: string; p_motif: string }
        Returns: undefined
      }
      supprimer_paiement: {
        Args: { p_motif: string; p_paiement_id: string }
        Returns: undefined
      }
      tg_audit: {
        Args: {
          p_action: string
          p_caisse_id: string
          p_entite_id: string
          p_entite_type: string
          p_payload?: Json
        }
        Returns: undefined
      }
    }
    Enums: {
      moyen_paiement: "especes" | "virement" | "autre"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      moyen_paiement: ["especes", "virement", "autre"],
    },
  },
} as const
