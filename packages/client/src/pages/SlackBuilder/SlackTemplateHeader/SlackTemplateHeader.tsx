import { ChangeEvent, KeyboardEvent, MouseEvent, useState } from "react";
import { Divider } from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import { GenericButton, Input } from "components/Elements";

import { BackButtonIcon } from "../../../components/Icons/Icons";

export interface IEmailHeaderProps {
  onPersonalizeClick: (e: MouseEvent<HTMLButtonElement>) => void;
  onAddTemplateClick?: (e: MouseEvent<HTMLButtonElement>) => void;
  onAddApiCallClick?: (e: MouseEvent<HTMLButtonElement>) => void;
  onSave?: (e: MouseEvent<HTMLButtonElement>) => void;
  templateName?: string;
  handleTemplateNameChange?: (e: ChangeEvent<HTMLInputElement>) => void;
  loading?: boolean;
}

const SlackTemplateHeader = (props: IEmailHeaderProps) => {
  const {
    onPersonalizeClick,
    onAddTemplateClick,
    onAddApiCallClick,
    templateName,
    handleTemplateNameChange,
    onSave,
    loading,
  } = props;
  const [titleEdit, setTitleEdit] = useState<boolean>(false);

  const handleTitleEdit = () => {
    setTitleEdit(!titleEdit);
  };

  const handleTitleEnter = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter") {
      handleTitleEdit();
    }
  };

  return (
    <div>
      <div className="flex text-center justify-between ml-[10px] h-[80px]">
        {handleTemplateNameChange && (
          <>
            <div className="font-[Poppins] font-medium text-[14px] leading-[30px] flex items-center">
              <div
                id="turnBackFromTemplate"
                className="min-w-[16px] pr-[16px] cursor-pointer"
                onClick={() => window.history.back()}
              >
                {BackButtonIcon()}
              </div>
              {!titleEdit ? (
                <h3 className="flex items-center gap-[10px]">
                  {templateName}
                  <EditIcon
                    sx={{ fontSize: "25px", cursor: "pointer" }}
                    onClick={handleTitleEdit}
                  />
                </h3>
              ) : (
                <Input
                  value={templateName}
                  placeholder={"Enter segment title"}
                  name="title"
                  id="title"
                  onChange={handleTemplateNameChange}
                  onKeyDown={handleTitleEnter}
                  autoFocus
                  inputProps={{
                    style: {
                      padding: "0px",
                      background: "#fff",
                      fontFamily: "Inter",
                      fontWeight: "600",
                      fontSize: "25px",
                      color: "#28282E",
                    },
                  }}
                />
              )}
            </div>
            <Divider />
          </>
        )}

        <div className="flex text-center justify-end items-center w-[400px] gap-[10px]">
          {onSave && (
            <div>
              <GenericButton
                id="saveDraftTemplate"
                onClick={onSave}
                style={{
                  whiteSpace: "nowrap",
                  maxWidth: "158px",
                  maxHeight: "48px",
                }}
                disabled={loading}
                loading={loading}
              >
                Save Draft
              </GenericButton>
            </div>
          )}

          {onPersonalizeClick && (
            <div>
              <GenericButton
                data-slackexporttemplate
                onClick={onPersonalizeClick}
                style={{
                  maxWidth: "158px",
                  maxHeight: "48px",
                }}
                disabled={loading}
                loading={loading}
              >
                Personalize
              </GenericButton>
            </div>
          )}

          {onAddTemplateClick && (
            <div>
              <GenericButton
                id="saveDraftTemplate"
                onClick={onAddTemplateClick}
                style={{
                  whiteSpace: "nowrap",
                  maxWidth: "158px",
                  maxHeight: "48px",
                }}
                disabled={loading}
                loading={loading}
              >
                Add Template
              </GenericButton>
            </div>
          )}
          {onAddApiCallClick && (
            <div>
              <GenericButton
                id="saveDraftTemplate"
                onClick={onAddApiCallClick}
                style={{
                  whiteSpace: "nowrap",
                  maxWidth: "158px",
                  maxHeight: "48px",
                }}
                disabled={loading}
                loading={loading}
              >
                Add Api Call
              </GenericButton>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SlackTemplateHeader;
