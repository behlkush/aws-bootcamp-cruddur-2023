import './ProfileForm.css';
import React from "react";
import process from 'process';
import { getAccessToken } from 'lib/CheckAuth';

export default function ProfileForm(props) {
  const [bio, setBio] = React.useState('');
  const [displayName, setDisplayName] = React.useState('');

  React.useEffect(() => {
    setBio(props.profile.bio || '');
    setDisplayName(props.profile.display_name);
  }, [props.profile])

  const s3uploadkey = async (extension) => {
    console.log('ext', extension)
    console.log('app frontend url', process.env.REACT_APP_FRONTEND_URL)
    try {
      // const gateway_url = `${process.env.REACT_APP_API_GATEWAY_ENDPOINT_URL}/avatars/key_upload`
      const gateway_url = "https://bnkslll1d7.execute-api.ca-central-1.amazonaws.com/avatars/key_upload"
      await getAccessToken()
      const access_token = localStorage.getItem("access_token")
      const res = await fetch(gateway_url, {
        method: "POST",
        headers: {
          'Origin': process.env.REACT_APP_FRONTEND_URL,
          'Authorization': `Bearer ${access_token}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      })
      let data = await res.json();
      if (res.status === 200) {
        console.log('presigned-url:', data)
        // return data.url
      } else {
        console.log('generate presigned url failed')
        console.log(res)
      }
    } catch (err) {
      console.log(err);
    }
  }
  const s3upload = async (event) => {
    console.log('event', event)
    const file = event.target.files[0]
    const filename = file.name
    const size = file.size
    const type = file.type
    const preview_image_url = URL.createObjectURL(file)
    const presignedurl = "https://cruddur-uploaded-avatars-owensound.s3.ca-central-1.amazonaws.com/mock.jpg?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=AKIAU7LD6UIQCOQQ2BSK%2F20230607%2Fca-central-1%2Fs3%2Faws4_request&X-Amz-Date=20230607T180745Z&X-Amz-Expires=30000&X-Amz-SignedHeaders=host&X-Amz-Signature=98d1231e1f8e86b45510de9e3da3ec416ecb646f3bca581e0e7d01f538dd8480"
    console.log(filename, size, type)
    // const formData = new FormData()
    // formData.append('file', file)
    // const fileparts = filename.split('.')
    // const extension = fileparts[fileparts.length - 1]
    // const presignedurl = await s3uploadkey(extension)
    try {
      console.log('s3upload')
      const res = await fetch(presignedurl, {
        method: "POST",
        body: file,
        headers: {
          'Content-Type': file.type
        }
      })
      let data = await res.json()
      if (res.status === 200) {
        console.log('presigned-url:', data)
      } else {
        console.log(res)
      }
    } catch (err) {
      console.log(err);
    }
  }

  const onsubmit = async (event) => {
    event.preventDefault();
    try {
      const backend_url = `${process.env.REACT_APP_BACKEND_URL}/api/profile/update`
      await getAccessToken()
      const access_token = localStorage.getItem("access_token")
      const res = await fetch(backend_url, {
        method: "POST",
        headers: {
          'Authorization': `Bearer ${access_token}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          bio: bio,
          display_name: displayName
        }),
      });
      let data = await res.json();
      if (res.status === 200) {
        setBio(null)
        setDisplayName(null)
        props.setPopped(false)
      } else {
        console.log(res)
      }
    } catch (err) {
      console.log(err);
    }
  }

  const bio_onchange = (event) => {
    setBio(event.target.value);
  }

  const display_name_onchange = (event) => {
    setDisplayName(event.target.value);
  }

  const close = (event) => {
    if (event.target.classList.contains("profile_popup")) {
      props.setPopped(false)
    }
  }

  if (props.popped === true) {
    return (
      <div className="popup_form_wrap profile_popup" onClick={close}>
        <form
          className='profile_form popup_form'
          onSubmit={onsubmit}
        >
          <div className="popup_heading">
            <div className="popup_title">Edit Profile</div>
            <div className='submit'>
              <button type='submit'>Save</button>
            </div>
          </div>
          <div className="popup_content">

            <div className="upload" onClick={s3uploadkey}>
              Avatar upload key
            </div>
            <input type="file" name="avatarupload" onChange={s3upload} /> 
            

            <div className="field display_name">
              <label>Display Name</label>
              <input
                type="text"
                placeholder="Display Name"
                value={displayName}
                onChange={display_name_onchange}
              />
            </div>
            <div className="field bio">
              <label>Bio</label>
              <textarea
                placeholder="Bio"
                value={bio}
                onChange={bio_onchange}
              />
            </div>
          </div>
        </form>
      </div>
    );
  }
}