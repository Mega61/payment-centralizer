terraform {
  required_version = ">= 1.5"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = ">= 4.66, != 4.75.0, < 6.0.0"
    }
  }
}
